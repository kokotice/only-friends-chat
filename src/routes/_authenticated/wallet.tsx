import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getMyTransactions } from "@/lib/queries";
import { Gift, Sparkles, Zap, UserCog, Dice5 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: txs = [] } = useQuery({ queryKey: ["txs"], queryFn: () => getMyTransactions(30) });
  const [newName, setNewName] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [busy, setBusy] = useState(false);

  const boostActive = me?.boost_until && new Date(me.boost_until) > new Date();
  const dailyReady = !me?.last_daily_at || new Date(me.last_daily_at).getTime() < Date.now() - 20 * 3600 * 1000;

  async function claimDaily() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_daily");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`+50 💖 (balance: ${data})`);
    qc.invalidateQueries();
  }

  async function boost() {
    setBusy(true);
    const { error } = await supabase.rpc("boost_profile");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile boosted for 24h ✨");
    qc.invalidateQueries();
  }

  async function changeName(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("change_username", { _new: newName.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Username changed to @${data}`);
    setNewName("");
    qc.invalidateQueries();
  }

  async function changeDisplay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDisplay.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("change_display_name", { _new: newDisplay.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Display name changed to ${data}`);
    setNewDisplay("");
    qc.invalidateQueries();
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-primary/40 via-primary/15 to-transparent p-6 md:p-8 border border-primary/30">
          <p className="text-sm text-muted-foreground">Your balance</p>
          <p className="mt-2 text-5xl md:text-6xl font-black tracking-tight">💖 {me?.sparks ?? 0}</p>
          <p className="mt-2 text-xs text-muted-foreground">Sparks · earn from likes, views, daily bonus & gambling</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={claimDaily} disabled={!dailyReady || busy} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary disabled:opacity-50">
            <Gift className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Daily bonus</div>
              <div className="text-xs text-muted-foreground">{dailyReady ? "+50 💖 available" : "Come back later"}</div>
            </div>
          </button>
          <Link to="/casino" className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary">
            <Dice5 className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Casino</div>
              <div className="text-xs text-muted-foreground">Coinflip & slots</div>
            </div>
          </Link>
          <button onClick={boost} disabled={busy || (me?.sparks ?? 0) < 100} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary disabled:opacity-50">
            <Zap className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Boost profile · 100 💖</div>
              <div className="text-xs text-muted-foreground">{boostActive ? "Active ✨" : "Get 24h of extra visibility"}</div>
            </div>
          </button>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <Sparkles className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0 text-xs text-muted-foreground">
              Earn: <b className="text-foreground">+5</b> per like received, <b className="text-foreground">+1</b> per view, <b className="text-foreground">+50</b> daily.
            </div>
          </div>
        </div>

        <form onSubmit={changeName} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Change username · 200 💖</div>
              <div className="text-xs text-muted-foreground">3-20 chars, a-z 0-9 _</div>
            </div>
          </div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="new_username"
              className="flex-1 min-w-0 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
            <button disabled={busy || (me?.sparks ?? 0) < 200 || !newName.trim()} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Change
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent activity</h2>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{prettyKind(t.kind)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                  <div className={`font-bold ${t.amount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount} 💖
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function prettyKind(k: string) {
  const map: Record<string, string> = {
    daily: "Daily bonus",
    coinflip_bet: "Coinflip wager",
    coinflip_win: "Coinflip win",
    slots_bet: "Slots wager",
    slots_win: "Slots win",
    tip_sent: "Tip sent",
    tip_received: "Tip received",
    username_change: "Username change",
    boost: "Profile boost",
    like_reward: "Like reward",
    view_reward: "View reward",
  };
  return map[k] ?? k;
}
