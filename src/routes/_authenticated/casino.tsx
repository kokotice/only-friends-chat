import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/casino")({
  component: CasinoPage,
});

function CasinoPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const balance = me?.sparks ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Casino</h1>
            <p className="text-xs text-muted-foreground">Gamble responsibly — it's just Sparks 😉</p>
          </div>
          <div className="rounded-full bg-primary/15 px-4 py-2 font-bold text-primary">💖 {balance}</div>
        </div>

        <Coinflip balance={balance} onDone={() => qc.invalidateQueries()} />
        <Slots balance={balance} onDone={() => qc.invalidateQueries()} />
      </div>
    </div>
  );
}

function Coinflip({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [wager, setWager] = useState(10);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ win: boolean; roll: string; payout: number } | null>(null);

  async function play() {
    if (wager < 1 || wager > balance) return toast.error("Bad wager");
    setBusy(true);
    const { data, error } = await supabase.rpc("gamble_coinflip", { _wager: wager, _pick: pick });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { win: boolean; roll: string; payout: number };
    setLast(r);
    toast[r.win ? "success" : "error"](r.win ? `You won ${r.payout} 💖!` : `Lost. It was ${r.roll}.`);
    onDone();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-bold">🪙 Coinflip · 2x payout</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["heads", "tails"] as const).map((p) => (
          <button key={p} onClick={() => setPick(p)}
            className={`rounded-xl border py-4 font-semibold capitalize ${pick === p ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            {p === "heads" ? "👑 Heads" : "🌟 Tails"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={1000} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={play} disabled={busy} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Flipping…" : "Flip"}
        </button>
      </div>
      {last && (
        <div className={`rounded-xl p-3 text-center text-sm ${last.win ? "bg-primary/20 text-primary" : "bg-muted"}`}>
          Landed on <b>{last.roll}</b> — {last.win ? `+${last.payout} 💖` : "no win"}
        </div>
      )}
    </div>
  );
}

function Slots({ balance, onDone }: { balance: number; onDone: () => void }) {
  const [wager, setWager] = useState(20);
  const [busy, setBusy] = useState(false);
  const [reels, setReels] = useState<string[]>(["❓", "❓", "❓"]);
  const [msg, setMsg] = useState<string | null>(null);

  async function spin() {
    if (wager < 1 || wager > balance) return toast.error("Bad wager");
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("gamble_slots", { _wager: wager });
    if (error) { setBusy(false); return toast.error(error.message); }
    const r = data as { reels: string[]; payout: number };
    // animate briefly
    let i = 0;
    const interval = setInterval(() => {
      setReels(["🍒🍋🔔⭐💎"[Math.floor(Math.random()*5)], "🍒🍋🔔⭐💎"[Math.floor(Math.random()*5)], "🍒🍋🔔⭐💎"[Math.floor(Math.random()*5)]]);
      if (++i >= 8) {
        clearInterval(interval);
        setReels(r.reels);
        setMsg(r.payout > wager ? `WIN +${r.payout} 💖` : r.payout === wager ? `Push — refunded ${r.payout} 💖` : `No luck this time`);
        setBusy(false);
        onDone();
      }
    }, 80);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-bold">🎰 Slots · up to 20x</h2>
      <div className="flex justify-center gap-2 rounded-2xl bg-black/60 p-4">
        {reels.map((r, i) => (
          <div key={i} className="flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-xl bg-background text-4xl md:text-5xl border border-primary/30">
            {r}
          </div>
        ))}
      </div>
      {msg && <div className="text-center text-sm font-semibold text-primary">{msg}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={2000} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={spin} disabled={busy} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Spinning…" : "Spin"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">3 match: 💎 20x · ⭐ 10x · 🔔 6x · 🍋 4x · 🍒 3x. 2 match: push.</p>
    </div>
  );
}
