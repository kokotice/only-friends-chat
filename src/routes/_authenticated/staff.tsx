import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, PUBLIC_PROFILE_COLUMNS } from "@/lib/queries";
import { Shield, Gift, MessageCircle, Flag } from "lucide-react";

const DISCORD = "https://discord.gg/wVSv5sT3dB";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
  head: () => ({
    meta: [
      { title: "Staff & Discord · OnlyFriends" },
      { name: "description", content: "Join the OnlyFriends Discord for a free theme and apply to become a moderator." },
      { property: "og:title", content: "Staff & Discord · OnlyFriends" },
      { property: "og:description", content: "Join the OnlyFriends Discord for a free theme and apply to become a moderator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

const REASON_LABEL: Record<string, string> = {
  racist: "Racism / hate speech",
  sexual_abuse: "Sexual abuse",
  underage: "Too young for OnlyFriends",
  other: "Other",
};

function StaffPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [why, setWhy] = useState("");

  const joined = !!(me as { discord_joined_at?: string | null } | undefined)?.discord_joined_at;

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles" as never).select("role");
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
  });
  const isStaff = roles.includes("moderator") || roles.includes("admin");

  const { data: application } = useQuery({
    queryKey: ["my-staff-application", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("staff_applications" as never).select("*").maybeSingle();
      return (data as { status: string } | null) ?? null;
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["reports", isStaff],
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase
        .from("reports" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as ReportRow[];
      const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id]))];
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", ids)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.username]));
      return rows.map((r) => ({
        ...r,
        reporter: map.get(r.reporter_id) ?? "unknown",
        reported: map.get(r.reported_user_id) ?? "unknown",
      }));
    },
  });

  async function claimGift() {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_discord_gift" as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { new?: boolean } | null;
    setGift(
      res?.new
        ? "Congratulations! Since you joined our Discord server we've prepared a special gift for you — the Discord Blurple theme is now in your collection."
        : "You already claimed your Discord gift — the Discord Blurple theme is in your collection.",
    );
    qc.invalidateQueries();
  }

  async function apply() {
    if (tag.trim().length < 2 || why.trim().length < 10) {
      return toast.error("Add your Discord tag and at least a short reason");
    }
    setBusy(true);
    const { error } = await supabase.from("staff_applications" as never).insert({
      user_id: me?.id,
      discord_tag: tag.trim().slice(0, 60),
      why: why.trim().slice(0, 1000),
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application sent — the OnlyFriends team will review it on Discord");
    qc.invalidateQueries({ queryKey: ["my-staff-application"] });
  }

  async function resolve(id: string, status: string) {
    const { error } = await supabase.from("reports" as never).update({ status } as never).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["reports"] });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:py-10">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Staff &amp; Discord</h1>
        </div>

        <section className="rounded-2xl border border-primary/40 bg-card p-5">
          <div className="flex items-start gap-3">
            <Gift className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Free theme for Discord members</div>
              <p className="text-xs text-muted-foreground">
                Join the OnlyFriends Discord and claim the exclusive <b>Discord Blurple</b> theme (+10% Sparks, +10% feed
                boost, +2% luck).
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={DISCORD}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <MessageCircle className="h-4 w-4" /> Join the Discord
                </a>
                <button
                  onClick={claimGift}
                  disabled={busy}
                  className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                >
                  I joined — claim my gift
                </button>
              </div>
              {gift && <p className="mt-3 rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary">🎉 {gift}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="font-semibold">Become a moderator</div>
          <p className="text-xs text-muted-foreground">
            OnlyFriends staff are picked from our Discord server. Join it, claim your gift, then apply below.
          </p>
          {isStaff ? (
            <p className="mt-3 text-sm font-semibold text-primary">You are OnlyFriends staff. Reports are listed below.</p>
          ) : application ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Application status: <span className="font-semibold text-foreground">{application.status}</span>
            </p>
          ) : !joined ? (
            <p className="mt-3 text-sm text-muted-foreground">Claim your Discord gift first to unlock the application.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                value={tag}
                maxLength={60}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Your Discord username"
                className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={why}
                maxLength={1000}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="Why should you be a moderator?"
                className="h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={apply}
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Apply for moderator
              </button>
            </div>
          )}
        </section>

        {isStaff && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <Flag className="h-5 w-5 text-destructive" /> Reports
            </div>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports right now.</p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-3">
                    <div className="text-sm font-semibold">
                      @{r.reported} · {REASON_LABEL[r.reason] ?? r.reason}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by @{r.reporter} · {new Date(r.created_at).toLocaleString()} · {r.status}
                    </div>
                    {r.details && <p className="mt-2 text-sm">{r.details}</p>}
                    {r.status === "open" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => resolve(r.id, "actioned")}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Mark actioned
                        </button>
                        <button
                          onClick={() => resolve(r.id, "dismissed")}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
