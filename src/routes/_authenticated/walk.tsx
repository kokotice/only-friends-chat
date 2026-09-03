import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Footprints, Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/walk")({
  component: WalkPage,
  head: () => ({
    meta: [
      { title: "Walk & Earn Sparks — OnlyFriends" },
      { name: "description", content: "Walk with your phone and earn Sparks for every step you take on OnlyFriends." },
      { property: "og:title", content: "Walk & Earn Sparks — OnlyFriends" },
      { property: "og:description", content: "Every step you take pays out Sparks. Walk 10 000 steps to unlock the casino." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MotionEventCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

function WalkPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const [tracking, setTracking] = useState(false);
  const [session, setSession] = useState(0);
  const [earned, setEarned] = useState(0);
  const [isMobile, setIsMobile] = useState(true);
  const [paused, setPaused] = useState(false);
  const pending = useRef(0);
  const lastPeak = useRef(0);
  // Adaptive filter state: gravity baseline + running noise estimate.
  const gravity = useRef(9.81);
  const noise = useRef(0.6);
  const armed = useRef(true);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setIsMobile(coarse && typeof DeviceMotionEvent !== "undefined");
  }, []);

  // Flush buffered steps to the server (max 25 per call, server-side rewards).
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
        /* wake lock unsupported or denied — tracking still works while visible */
      }
    };
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setPaused(false);
        request();
      } else {
        // Motion events stop when the tab/screen goes away: bank what we have.
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
      // Prefer gravity-free acceleration when the device provides it.
      const linear = e.acceleration;
      const raw = linear && linear.x !== null
        ? Math.sqrt((linear.x ?? 0) ** 2 + (linear.y ?? 0) ** 2 + (linear.z ?? 0) ** 2)
        : (() => {
            const a = e.accelerationIncludingGravity;
            if (!a) return null;
            const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
            // High-pass: track gravity slowly, subtract it out.
            gravity.current += (mag - gravity.current) * 0.08;
            return Math.abs(mag - gravity.current);
          })();
      if (raw === null) return;

      // Running noise floor -> adaptive threshold, so gentle and hard walkers both count.
      noise.current += (raw - noise.current) * 0.05;
      const high = Math.max(1.1, noise.current * 1.6);
      const low = high * 0.55;
      const now = Date.now();

      // Hysteresis + refractory window: one count per real stride, 0.2–2s cadence.
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

  async function start() {
    const Ctor = DeviceMotionEvent as MotionEventCtor;
    if (typeof Ctor?.requestPermission === "function") {
      try {
        const res = await Ctor.requestPermission();
        if (res !== "granted") return toast.error("Motion access denied");
      } catch {
        return toast.error("Motion access unavailable");
      }
    }
    gravity.current = 9.81;
    noise.current = 0.6;
    armed.current = true;
    setTracking(true);
    toast.success("Walking! Keep OnlyFriends open — your screen will stay on.");
  }

  function stop() {
    setTracking(false);
    setPaused(false);
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    flush();
  }


  const total = me?.steps_total ?? 0;
  const toCasino = Math.max(0, 10000 - total);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Walk &amp; Earn</h1>
            <p className="text-xs text-muted-foreground">Every step pays Sparks. Walk to scroll.</p>
          </div>
          <div className="rounded-full bg-primary/15 px-4 py-2 font-bold text-primary">💖 {me?.sparks ?? 0}</div>
        </div>

        {!isMobile ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
            <Smartphone className="mx-auto h-8 w-8 text-primary" />
            <h2 className="font-bold">Phone only</h2>
            <p className="text-sm text-muted-foreground">
              Step tracking needs a phone's motion sensor. Open OnlyFriends on your phone and walk to farm Sparks.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
            <Footprints className={`mx-auto h-10 w-10 text-primary ${tracking ? "animate-bounce" : ""}`} />
            <div>
              <div className="text-4xl font-black">{session}</div>
              <div className="text-xs text-muted-foreground">steps this session · +{earned} 💖 earned</div>
            </div>
            <button
              onClick={tracking ? stop : start}
              className={`w-full rounded-xl py-3 font-bold ${tracking ? "border border-border" : "bg-primary text-primary-foreground"}`}
            >
              {tracking ? "Stop walking" : "Start walking"}
            </button>
            {tracking && (
              <p className="text-xs text-muted-foreground">
                {paused
                  ? "Paused — phone screen off or app in background. Reopen OnlyFriends to keep counting."
                  : "Screen kept awake. Pocket the phone with the app open and walk."}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Phones block websites from reading motion with the screen off, so steps only count while OnlyFriends is
              open. Add it to your home screen for the smoothest walk.
            </p>
          </div>
        )}


        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Lifetime steps</span>
            <span className="font-bold text-primary">{total.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, (total / 10000) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {me?.casino_unlocked
              ? "Casino unlocked 🎰"
              : `${toCasino.toLocaleString()} steps left to unlock the Casino for free.`}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Payout per step</p>
          <p>50% → 1–3 💖 · 30% → 3–5 💖 · 15% → 6–10 💖</p>
          <p>4% → 10–20 💖 · 0.9% → 20–200 💖 · 0.1% → 200–1000 💖</p>
        </div>
      </div>
    </div>
  );
}
