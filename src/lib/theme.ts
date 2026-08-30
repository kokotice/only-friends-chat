import { supabase } from "@/integrations/supabase/client";

export type ThemeRow = {
  key: string;
  name: string;
  rarity: Rarity;
  bg_l: number; bg_c: number; bg_h: number;
  ac_l: number; ac_c: number; ac_h: number;
  luck_bonus: number;
  spark_bonus: number;
  feed_bonus: number;
  blurb: string | null;
};

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

export const RARITY_STYLE: Record<Rarity, { label: string; ring: string; text: string; bg: string }> = {
  common: { label: "Common", ring: "border-zinc-600", text: "text-zinc-300", bg: "bg-zinc-500/10" },
  uncommon: { label: "Uncommon", ring: "border-sky-500", text: "text-sky-300", bg: "bg-sky-500/10" },
  rare: { label: "Rare", ring: "border-indigo-500", text: "text-indigo-300", bg: "bg-indigo-500/10" },
  epic: { label: "Epic", ring: "border-fuchsia-500", text: "text-fuchsia-300", bg: "bg-fuchsia-500/10" },
  legendary: { label: "Legendary", ring: "border-amber-400", text: "text-amber-300", bg: "bg-amber-400/10" },
  mythic: { label: "Mythic", ring: "border-rose-500", text: "text-rose-300", bg: "bg-rose-500/10" },
};

const ok = (l: number, c: number, h: number) => `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h})`;

/** Derives the full design-token set from a theme's base + accent color. */
export function themeVars(t: ThemeRow): Record<string, string> {
  const bl = Number(t.bg_l), bc = Number(t.bg_c), bh = Number(t.bg_h);
  const al = Number(t.ac_l), ac = Number(t.ac_c), ah = Number(t.ac_h);
  const primary = ok(al, ac, ah);
  return {
    "--background": ok(bl, bc, bh),
    "--foreground": "oklch(0.98 0 0)",
    "--card": ok(bl + 0.04, bc + 0.003, bh),
    "--card-foreground": "oklch(0.98 0 0)",
    "--popover": ok(bl + 0.04, bc + 0.003, bh),
    "--popover-foreground": "oklch(0.98 0 0)",
    "--primary": primary,
    "--primary-foreground": ok(0.15, 0, 0),
    "--secondary": ok(bl + 0.1, bc + 0.005, bh),
    "--secondary-foreground": "oklch(0.98 0 0)",
    "--muted": ok(bl + 0.08, bc + 0.003, bh),
    "--muted-foreground": ok(0.68, 0.02, bh),
    "--accent": ok(bl + 0.14, Math.min(0.06, ac * 0.25), ah),
    "--accent-foreground": "oklch(0.98 0 0)",
    "--border": ok(bl + 0.12, bc + 0.005, bh),
    "--input": ok(bl + 0.08, bc + 0.003, bh),
    "--ring": primary,
    "--sidebar": ok(Math.max(0.04, bl - 0.03), bc + 0.001, bh),
    "--sidebar-foreground": "oklch(0.88 0 0)",
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": ok(0.15, 0, 0),
    "--sidebar-accent": ok(bl + 0.06, bc + 0.005, bh),
    "--sidebar-accent-foreground": "oklch(0.98 0 0)",
    "--sidebar-border": ok(bl + 0.08, bc + 0.003, bh),
    "--sidebar-ring": primary,
  };
}

export function applyTheme(t: ThemeRow | null | undefined) {
  if (typeof document === "undefined" || !t) return;
  const root = document.documentElement;
  const vars = themeVars(t);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

export function swatch(t: ThemeRow) {
  return {
    bg: `oklch(${t.bg_l} ${t.bg_c} ${t.bg_h})`,
    accent: `oklch(${t.ac_l} ${t.ac_c} ${t.ac_h})`,
  };
}

export async function getThemes(): Promise<ThemeRow[]> {
  const { data } = await supabase.from("themes").select("*");
  return (data ?? []) as unknown as ThemeRow[];
}

export async function getMyThemeKeys(): Promise<string[]> {
  const { data } = await supabase.from("user_themes").select("theme_key");
  return (data ?? []).map((r) => r.theme_key);
}

export async function getCrates() {
  const { data } = await supabase.from("crates").select("*").order("sort");
  return (data ?? []) as unknown as {
    key: string; name: string; cost: number; odds: Record<string, number>; blurb: string | null; sort: number;
  }[];
}
