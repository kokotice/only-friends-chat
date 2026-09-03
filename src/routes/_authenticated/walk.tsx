import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/queries";
import { useStepTracker } from "@/hooks/useStepTracker";
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

function WalkPage() {
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { supported: isMobile, tracking, paused, session, earned, start, stop } = useStepTracker();



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
                  : "Tracking stays on everywhere in the app — go doomscroll the feed and keep earning."}
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
