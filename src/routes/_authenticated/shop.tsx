import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { Zap, HardDrive, ImagePlus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/shop")({
  component: ShopPage,
  head: () => ({
    meta: [
      { title: "Sparks Shop · OnlyFriends" },
      { name: "description", content: "Spend your Sparks on generators, bigger uploads and a custom profile picture." },
      { property: "og:title", content: "Sparks Shop · OnlyFriends" },
      { property: "og:description", content: "Spend your Sparks on generators, bigger uploads and a custom profile picture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ShopPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  const genUntil = me?.gen_until ? new Date(me.gen_until).getTime() : 0;
  const genActive = genUntil > now;
  const secsLeft = Math.max(0, Math.round((genUntil - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // auto-claim generator income while it runs
  useEffect(() => {
    if (!genUntil) return;
    async function claim() {
      const { data, error } = await supabase.rpc("claim_generator");
      if (!error && (data ?? 0) > 0) qc.invalidateQueries({ queryKey: ["my-profile"] });
    }
    claim();
    const t = setInterval(claim, 15000);
    return () => clearInterval(t);
  }, [genUntil, qc]);

  async function buyGenerator() {
    setBusy(true);
    const { error } = await supabase.rpc("buy_spark_generator");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Spark generator running — 1.2 💖/sec for 30 min");
    qc.invalidateQueries();
  }

  async function buyUpload() {
    setBusy(true);
    const { error } = await supabase.rpc("buy_upload_boost");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Upload limit raised to 800 MB");
    qc.invalidateQueries();
  }


  async function removeAvatar() {
    if (!me) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", me.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Back to the default letter avatar");
    qc.invalidateQueries();
  }

  const uploadUnlocked = (me?.max_upload_mb ?? 60) >= 800;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Shop</h1>
          </div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">💖 {me?.sparks ?? 0}</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Zap className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Spark generator · 1000 💖</div>
              <p className="text-xs text-muted-foreground">Earn ×1.2 Sparks every second for 30 minutes (~2160 💖 total).</p>
              {genActive && (
                <p className="mt-2 text-xs font-semibold text-primary">
                  Running · {Math.floor(secsLeft / 60)}m {secsLeft % 60}s left
                </p>
              )}
            </div>
            <button onClick={buyGenerator} disabled={busy || (me?.sparks ?? 0) < 1000}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {genActive ? "Extend" : "Buy"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <HardDrive className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Big uploads · 5000 💖</div>
              <p className="text-xs text-muted-foreground">
                Post videos up to 800 MB instead of 60 MB. {uploadUnlocked && <b className="text-primary">Unlocked ✓</b>}
              </p>
            </div>
            <button onClick={buyUpload} disabled={busy || uploadUnlocked || (me?.sparks ?? 0) < 5000}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {uploadUnlocked ? "Owned" : "Buy"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ImagePlus className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Profile picture · free</div>
              <p className="text-xs text-muted-foreground">Replace the default letter avatar with a PNG, JPG or SVG (max 5MB).</p>
              <div className="mt-3 flex items-center gap-3">
                <UserAvatar path={me?.avatar_url} name={me?.display_name ?? me?.username ?? "?"} className="h-16 w-16 text-xl" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={busy}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    Upload image
                  </button>
                  {me?.avatar_url && (
                    <button onClick={removeAvatar} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
                      Reset
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={pickAvatar} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
