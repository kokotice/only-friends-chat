import { useEffect, useState, type ReactNode } from "react";
import logo from "@/assets/logo.png";

// ── Prank switch ──────────────────────────────────────────────
// Set to false to bring the site back for everyone.
export const MAINTENANCE_MODE = true;
// Add ?letmein=1 to any URL to bypass (saved in this browser).
const BYPASS_KEY = "of-bypass";
const DEADLINE_KEY = "of-maintenance-deadline";
// ──────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [left, setLeft] = useState(24 * 60 * 60 * 1000);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("letmein") === "1") localStorage.setItem(BYPASS_KEY, "1");
    if (params.get("letmein") === "0") localStorage.removeItem(BYPASS_KEY);
    setBypass(localStorage.getItem(BYPASS_KEY) === "1");

    let deadline = Number(localStorage.getItem(DEADLINE_KEY));
    if (!deadline || Number.isNaN(deadline) || deadline < Date.now()) {
      deadline = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(DEADLINE_KEY, String(deadline));
    }
    const tick = () => setLeft(deadline - Date.now());
    tick();
    setReady(true);
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!MAINTENANCE_MODE) return <>{children}</>;
  if (!ready) return <div className="min-h-screen bg-background" />;
  if (bypass) return <>{children}</>;

  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, oklch(0.72 0.24 358 / 0.18), transparent 55%), radial-gradient(circle at 75% 85%, oklch(0.6 0.22 320 / 0.15), transparent 55%)",
        }}
      />
      <div className="relative w-full max-w-lg text-center">
        <img src={logo} alt="OnlyFriends" className="mx-auto h-14 w-14 opacity-70 grayscale" />
        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          All services offline
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">
          OnlyFriends is temporarily shut down
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          We're performing emergency infrastructure maintenance. Messages, feeds, streams and
          wallets are paused. Nothing is lost — everything comes back online automatically.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          {[
            { v: pad(h), l: "hours" },
            { v: pad(m), l: "min" },
            { v: pad(s), l: "sec" },
          ].map((x) => (
            <div key={x.l} className="min-w-[74px] rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-3xl font-bold tabular-nums text-primary">{x.v}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{x.l}</div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Status: <span className="text-foreground">degraded — 0 of 6 services operational</span>
        </p>
      </div>
    </div>
  );
}
