import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import {
  applyTheme, getCrates, getMyThemeKeys, getThemes, RARITY_ORDER, RARITY_STYLE, swatch,
  type Rarity, type ThemeRow,
} from "@/lib/theme";
import { Package, Check, Sparkles, Dice5, TrendingUp, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crates")({
  component: CratesPage,
  head: () => ({
    meta: [
      { title: "Crates & Themes · OnlyFriends" },
      { name: "description", content: "Open Spark crates to unlock 33 collectible OnlyFriends themes with luck, Spark and feed-reach perks." },
      { property: "og:title", content: "Crates & Themes · OnlyFriends" },
      { property: "og:description", content: "Open Spark crates and unlock collectible themes with real in-app perks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function pct(n: number) {
  return `${Math.round(Number(n) * 100)}%`;
}

function CratesPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: themes = [] } = useQuery({ queryKey: ["themes"], queryFn: getThemes });
  const { data: owned = [] } = useQuery({ queryKey: ["my-themes"], queryFn: getMyThemeKeys });
  const { data: crates = [] } = useQuery({ queryKey: ["crates"], queryFn: getCrates });
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ theme: ThemeRow; dupe: boolean; refund: number } | null>(null);

  const balance = me?.sparks ?? 0;
  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const active = themes.find((t) => t.key === me?.active_theme);

  const byRarity = useMemo(() => {
    const m = new Map<Rarity, ThemeRow[]>();
    for (const r of RARITY_ORDER) m.set(r, []);
    for (const t of themes) m.get(t.rarity)?.push(t);
    return m;
  }, [themes]);

  async function open(key: string, cost: number) {
    if (balance < cost) return toast.error("Not enough Sparks");
    setBusy(key);
    const { data, error } = await supabase.rpc("open_crate", { _key: key });
    setBusy(null);
    if (error) return toast.error(error.message);
    const r = data as unknown as { theme: ThemeRow; dupe: boolean; refund: number };
    setReveal(r);
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["my-themes"] });
    toast[r.dupe ? "info" : "success"](
      r.dupe ? `Duplicate ${r.theme.name} — refunded ${r.refund} 💖` : `Unboxed ${r.theme.name}!`,
    );
  }

  async function equip(t: ThemeRow) {
    const { error } = await supabase.rpc("equip_theme", { _key: t.key });
    if (error) return toast.error(error.message);
    applyTheme(t);
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    toast.success(`${t.name} equipped`);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-10 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Crates</h1>
            <p className="text-xs text-muted-foreground">
              33 collectible themes. Rarer themes carry stronger perks. Duplicates refund Sparks.
            </p>
          </div>
          <div className="rounded-full bg-primary/15 px-4 py-2 font-bold text-primary">💖 {balance}</div>
        </header>

        {active && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Equipped</div>
            <div className="mt-1 flex items-center gap-3">
              <Swatch t={active} />
              <div className="min-w-0">
                <div className="font-bold">{active.name}</div>
                <PerkRow t={active} />
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          {crates.map((c) => (
            <div key={c.key} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h2 className="font-bold">{c.name}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{c.blurb}</p>
              <div className="flex flex-wrap gap-1">
                {RARITY_ORDER.filter((r) => c.odds[r]).map((r) => (
                  <span key={r} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RARITY_STYLE[r].ring} ${RARITY_STYLE[r].text} ${RARITY_STYLE[r].bg}`}>
                    {RARITY_STYLE[r].label} {c.odds[r]}%
                  </span>
                ))}
              </div>
              <button
                onClick={() => open(c.key, c.cost)}
                disabled={busy === c.key || balance < c.cost}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy === c.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Open · 💖 {c.cost}</>}
              </button>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-bold">Collection · {ownedSet.size}/{themes.length}</h2>
          {RARITY_ORDER.map((r) => {
            const list = byRarity.get(r) ?? [];
            if (list.length === 0) return null;
            const s = RARITY_STYLE[r];
            return (
              <div key={r} className="space-y-2">
                <h3 className={`text-sm font-bold ${s.text}`}>{s.label}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => {
                    const own = ownedSet.has(t.key);
                    const isActive = me?.active_theme === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => own && !isActive && equip(t)}
                        disabled={!own || isActive}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-opacity ${s.ring} ${own ? "" : "opacity-40"} ${isActive ? s.bg : ""}`}
                      >
                        <Swatch t={t} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-semibold">
                            <span className="truncate">{t.name}</span>
                            {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                          </div>
                          <PerkRow t={t} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setReveal(null)}>
          <div
            className={`w-full max-w-sm rounded-2xl border-2 bg-card p-6 text-center ${RARITY_STYLE[reveal.theme.rarity].ring}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`text-xs font-bold uppercase tracking-widest ${RARITY_STYLE[reveal.theme.rarity].text}`}>
              {RARITY_STYLE[reveal.theme.rarity].label}
            </div>
            <div className="mx-auto my-4 h-20 w-20 rounded-2xl border border-border" style={{ background: `linear-gradient(135deg, ${swatch(reveal.theme).bg}, ${swatch(reveal.theme).accent})` }} />
            <h3 className="text-xl font-black">{reveal.theme.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{reveal.theme.blurb}</p>
            {reveal.dupe && <p className="mt-2 text-sm text-primary">Duplicate — refunded 💖 {reveal.refund}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setReveal(null)} className="flex-1 rounded-xl border border-border py-2 text-sm">Close</button>
              <button
                onClick={() => { equip(reveal.theme); setReveal(null); }}
                className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
              >
                Equip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Swatch({ t }: { t: ThemeRow }) {
  const s = swatch(t);
  return (
    <div
      className="h-10 w-10 shrink-0 rounded-lg border border-border"
      style={{ background: `linear-gradient(135deg, ${s.bg} 45%, ${s.accent})` }}
    />
  );
}

function PerkRow({ t }: { t: ThemeRow }) {
  const perks: string[] = [];
  if (Number(t.luck_bonus) > 0) perks.push(`luck ${pct(t.luck_bonus)}`);
  if (Number(t.spark_bonus) > 0) perks.push(`sparks ${pct(t.spark_bonus)}`);
  if (Number(t.feed_bonus) > 0) perks.push(`reach ${pct(t.feed_bonus)}`);
  if (perks.length === 0) return <div className="text-[11px] text-muted-foreground">No perks</div>;
  return (
    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
      {Number(t.luck_bonus) > 0 && <span className="flex items-center gap-0.5"><Dice5 className="h-3 w-3" />+{pct(t.luck_bonus)}</span>}
      {Number(t.spark_bonus) > 0 && <span className="flex items-center gap-0.5"><Sparkles className="h-3 w-3" />+{pct(t.spark_bonus)}</span>}
      {Number(t.feed_bonus) > 0 && <span className="flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{pct(t.feed_bonus)}</span>}
    </div>
  );
}
