import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type MotionEventCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

type StepTracker = {
  supported: boolean;
  tracking: boolean;
  paused: boolean;
  session: number;
  earned: number;
  start: () => Promise<void>;
  stop: () => void;
};

const Ctx = createContext<StepTracker | null>(null);

const STORAGE_KEY = "of-walk-active";

export function StepTrackerProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [supported, setSupported] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [session, setSession] = useState(0);
  const [earned, setEarned] = useState(0);

  const pending = useRef(0);
  const lastPeak = useRef(0);
  const gravity = useRef(9.81);
  const noise = useRef(0.6);
  const armed = useRef(true);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Detect a motion-capable phone, and resume a walk that was running before a reload.
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const ok = coarse && typeof DeviceMotionEvent !== "undefined";
    setSupported(ok);
    if (ok && localStorage.getItem(STORAGE_KEY) === "1") {
      const Ctor = DeviceMotionEvent as MotionEventCtor;
      // iOS needs a fresh user gesture for permission; other platforms can resume silently.
      if (typeof Ctor?.requestPermission !== "function") setTracking(true);
    }
  }, []);

  const flush = useCallback(async () => {
    const n = Math.min(pending.current, 25);
    if (n < 1) return;
    pending.current -= n;
    const { data, error } = await supabase.rpc("record_steps", { _n: n });
    if (error) return;
    const r = data as { gained: number } | null;
    if (r) {
      setEarned((e) => e + r.gained);
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    }
  }, [qc]);

  useEffect(() => {
    if (!tracking) return;
    const id = setInterval(flush, 2000);
    return () => clearInterval(id);
  }, [tracking, flush]);

  // Keep the screen awake so the OS keeps delivering motion events.
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    const request = async () => {
      try {
        if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
        const s = await navigator.wakeLock.request("screen");
        if (cancelled) return void s.release();
        wakeLock.current = s;
      } catch {
        /* unsupported or denied */
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setPaused(false);
        request();
      } else {
        setPaused(true);
        flush();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [tracking, flush]);

  useEffect(() => {
    if (!tracking) return;
    const onMotion = (e: DeviceMotionEvent) => {
      const linear = e.acceleration;
      const raw =
        linear && linear.x !== null
          ? Math.sqrt((linear.x ?? 0) ** 2 + (linear.y ?? 0) ** 2 + (linear.z ?? 0) ** 2)
          : (() => {
              const a = e.accelerationIncludingGravity;
              if (!a) return null;
              const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
              gravity.current += (mag - gravity.current) * 0.08;
              return Math.abs(mag - gravity.current);
            })();
      if (raw === null) return;

      noise.current += (raw - noise.current) * 0.05;
      const high = Math.max(1.1, noise.current * 1.6);
      const low = high * 0.55;
      const now = Date.now();

      if (armed.current && raw > high && now - lastPeak.current > 250) {
        armed.current = false;
        lastPeak.current = now;
        pending.current += 1;
        setSession((s) => s + 1);
      } else if (!armed.current && raw < low) {
        armed.current = true;
      }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [tracking]);

  const start = useCallback(async () => {
    const Ctor = DeviceMotionEvent as MotionEventCtor;
    if (typeof Ctor?.requestPermission === "function") {
      try {
        const res = await Ctor.requestPermission();
        if (res !== "granted") return void toast.error("Motion access denied");
      } catch {
        return void toast.error("Motion access unavailable");
      }
    }
    gravity.current = 9.81;
    noise.current = 0.6;
    armed.current = true;
    localStorage.setItem(STORAGE_KEY, "1");
    setTracking(true);
    toast.success("Walking! Keep scrolling — steps count anywhere in the app.");
  }, []);

  const stop = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTracking(false);
    setPaused(false);
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    flush();
  }, [flush]);

  return (
    <Ctx.Provider value={{ supported, tracking, paused, session, earned, start, stop }}>{children}</Ctx.Provider>
  );
}

export function useStepTracker() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStepTracker must be used inside StepTrackerProvider");
  return ctx;
}
