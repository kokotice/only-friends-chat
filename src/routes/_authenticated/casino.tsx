import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [unlocking, setUnlocking] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const cooldown = Math.max(0, Math.ceil((until - now) / 1000));
  const startCooldown = () => setUntil(Date.now() + 10_000);

  const isPhone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const platform = isPhone ? "mobile" : "pc";
  const cost = isPhone ? 150000 : 30000;
  const steps = me?.steps_total ?? 0;

  async function unlock() {
    setUnlocking(true);
    const { data, error } = await supabase.rpc("unlock_casino", { _platform: platform });
    setUnlocking(false);
    if (error) return toast.error(error.message);
    const r = data as { via?: string } | null;
    toast.success(r?.via === "steps" ? "Casino unlocked with your steps 🎰" : "Casino unlocked 🎰");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  }

  if (me && !me.casino_unlocked) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-lg px-4 py-10 space-y-5 text-center">
          <h1 className="text-2xl md:text-3xl font-black">🎰 Casino is locked</h1>
          <p className="text-sm text-muted-foreground">
            Unlock it for {cost.toLocaleString()} 💖 on {isPhone ? "phone" : "PC"} — or walk 10 000 steps and get it free.
          </p>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Your steps</span>
              <span className="font-bold text-primary">{steps.toLocaleString()} / 10 000</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, (steps / 10000) * 100)}%` }} />
            </div>
            <div className="flex items-center justify-between text-sm pt-2">
              <span>Your balance</span>
              <span className="font-bold text-primary">💖 {balance}</span>
            </div>
          </div>
          <button
            onClick={unlock}
            disabled={unlocking || (steps < 10000 && balance < cost)}
            className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {steps >= 10000 ? "Claim free unlock" : `Unlock for ${cost.toLocaleString()} 💖`}
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Casino</h1>
            <p className="text-xs text-muted-foreground">No bet limits — 10s cooldown between bets. Equip a themed crate drop for extra luck.</p>
          </div>
          <div className="rounded-full bg-primary/15 px-4 py-2 font-bold text-primary">💖 {balance}</div>
        </div>

        <div className={`rounded-xl border px-4 py-2 text-center text-sm font-semibold ${cooldown > 0 ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          {cooldown > 0 ? `Cooldown — next bet in ${cooldown}s` : "Ready to bet"}
        </div>

        <Coinflip balance={balance} cooldown={cooldown} onBet={startCooldown} onDone={() => qc.invalidateQueries()} />
        <Dice balance={balance} cooldown={cooldown} onBet={startCooldown} onDone={() => qc.invalidateQueries()} />
        <Wheel balance={balance} cooldown={cooldown} onBet={startCooldown} onDone={() => qc.invalidateQueries()} />
        <Slots balance={balance} cooldown={cooldown} onBet={startCooldown} onDone={() => qc.invalidateQueries()} />
      </div>
    </div>
  );
}

function Coinflip({ balance, onDone, cooldown, onBet }: { balance: number; onDone: () => void; cooldown: number; onBet: () => void }) {
  const [wager, setWager] = useState(10);
  const [pick, setPick] = useState<"heads" | "tails">("heads");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ win: boolean; roll: string; payout: number } | null>(null);

  async function play() {
    if (wager < 1) return toast.error("Minimum bet is 1 💖");
    if (wager > balance) return toast.error("Not enough Sparks");
    if (cooldown > 0) return toast.error(`Wait ${cooldown}s before your next bet`);
    onBet();
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
      <h2 className="text-lg font-bold">🪙 Coinflip · 1.92x payout</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["heads", "tails"] as const).map((p) => (
          <button key={p} onClick={() => setPick(p)}
            className={`rounded-xl border py-4 font-semibold capitalize ${pick === p ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            {p === "heads" ? "👑 Heads" : "🌟 Tails"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={() => setWager(Math.max(1, balance))} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">All in</button>
        <button onClick={play} disabled={busy || cooldown > 0} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {cooldown > 0 ? `${cooldown}s` : busy ? "Flipping…" : "Flip"}
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

function Slots({ balance, onDone, cooldown, onBet }: { balance: number; onDone: () => void; cooldown: number; onBet: () => void }) {
  const [wager, setWager] = useState(20);
  const [busy, setBusy] = useState(false);
  const [reels, setReels] = useState<string[]>(["❓", "❓", "❓"]);
  const [msg, setMsg] = useState<string | null>(null);

  async function spin() {
    if (wager < 1) return toast.error("Minimum bet is 1 💖");
    if (wager > balance) return toast.error("Not enough Sparks");
    if (cooldown > 0) return toast.error(`Wait ${cooldown}s before your next bet`);
    onBet();
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
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={() => setWager(Math.max(1, balance))} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">All in</button>
        <button onClick={spin} disabled={busy || cooldown > 0} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {cooldown > 0 ? `${cooldown}s` : busy ? "Spinning…" : "Spin"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">3 match: 💎 18x · ⭐ 9x · 🔔 5x · 🍋 4x · 🍒 3x. 2 match: push.</p>
    </div>
  );
}

function Dice({ balance, onDone, cooldown, onBet }: { balance: number; onDone: () => void; cooldown: number; onBet: () => void }) {
  const [wager, setWager] = useState(10);
  const [pick, setPick] = useState<"over" | "under">("over");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ win: boolean; roll: number; payout: number } | null>(null);

  async function play() {
    if (wager < 1) return toast.error("Minimum bet is 1 💖");
    if (wager > balance) return toast.error("Not enough Sparks");
    if (cooldown > 0) return toast.error(`Wait ${cooldown}s before your next bet`);
    onBet();
    setBusy(true);
    const { data, error } = await supabase.rpc("gamble_dice", { _wager: wager, _pick: pick });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as { win: boolean; roll: number; payout: number };
    setLast(r);
    toast[r.win ? "success" : "error"](r.win ? `Rolled ${r.roll} · +${r.payout} 💖` : `Rolled ${r.roll}. Lost.`);
    onDone();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-bold">🎲 Dice · 1.9x · over 52 / under 48</h2>
      <div className="grid grid-cols-2 gap-2">
        {(["under", "over"] as const).map((p) => (
          <button key={p} onClick={() => setPick(p)}
            className={`rounded-xl border py-4 font-semibold capitalize ${pick === p ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            {p === "under" ? "⬇️ Under 50" : "⬆️ Over 50"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={() => setWager(Math.max(1, balance))} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">All in</button>
        <button onClick={play} disabled={busy || cooldown > 0} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {cooldown > 0 ? `${cooldown}s` : busy ? "Rolling…" : "Roll"}
        </button>
      </div>
      {last && (
        <div className={`rounded-xl p-3 text-center text-sm ${last.win ? "bg-primary/20 text-primary" : "bg-muted"}`}>
          Rolled <b>{last.roll}</b> — {last.win ? `+${last.payout} 💖` : "no win"}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Roll of exactly 50 loses. Fair edge ~2.5%.</p>
    </div>
  );
}

function Wheel({ balance, onDone, cooldown, onBet }: { balance: number; onDone: () => void; cooldown: number; onBet: () => void }) {
  const [wager, setWager] = useState(20);
  const [busy, setBusy] = useState(false);
  const [spin, setSpin] = useState<string>("—");
  const [msg, setMsg] = useState<string | null>(null);

  async function play() {
    if (wager < 1) return toast.error("Minimum bet is 1 💖");
    if (wager > balance) return toast.error("Not enough Sparks");
    if (cooldown > 0) return toast.error(`Wait ${cooldown}s before your next bet`);
    onBet();
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("gamble_wheel", { _wager: wager });
    if (error) { setBusy(false); return toast.error(error.message); }
    const r = data as { mult: number; payout: number };
    const slots = ["0x", "1.5x", "2.5x", "4x", "9x", "0x", "1.5x", "0x"];
    let i = 0;
    const iv = setInterval(() => {
      setSpin(slots[Math.floor(Math.random() * slots.length)]);
      if (++i >= 12) {
        clearInterval(iv);
        setSpin(`${r.mult}x`);
        setMsg(r.payout > 0 ? `WIN +${r.payout} 💖` : "No luck");
        setBusy(false);
        onDone();
      }
    }, 90);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="text-lg font-bold">🎡 Wheel · up to 9x</h2>
      <div className="flex justify-center rounded-2xl bg-black/60 p-6">
        <div className="flex h-24 w-40 items-center justify-center rounded-xl bg-background text-4xl font-black text-primary border border-primary/30">
          {spin}
        </div>
      </div>
      {msg && <div className="text-center text-sm font-semibold text-primary">{msg}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min={1} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value) || 0))}
          className="w-24 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
        {[10, 50, 100, 500, 1000].map((v) => (
          <button key={v} onClick={() => setWager(v)} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">{v}</button>
        ))}
        <button onClick={() => setWager(Math.max(1, balance))} className="rounded-lg border border-border px-3 py-2 text-xs hover:border-primary">All in</button>
        <button onClick={play} disabled={busy || cooldown > 0} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {cooldown > 0 ? `${cooldown}s` : busy ? "Spinning…" : "Spin"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">Odds: 1.5x (25%) · 2.5x (10%) · 4x (4%) · 9x (1%) · else 0x. Theme luck perks improve every game.</p>
    </div>
  );
}
