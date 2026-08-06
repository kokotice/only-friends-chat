import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { X, Flag } from "lucide-react";

const REASONS = [
  { key: "racist", label: "Racism / hate speech" },
  { key: "sexual_abuse", label: "Sexual abuse or harassment" },
  { key: "underage", label: "This person is too young to use OnlyFriends" },
  { key: "other", label: "Something else" },
] as const;

type ReasonKey = (typeof REASONS)[number]["key"];

export function ReportDialog({
  open,
  onOpenChange,
  reportedUserId,
  username,
  postId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportedUserId: string;
  username: string;
  postId?: string;
}) {
  const [reason, setReason] = useState<ReasonKey>("racist");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (details.length > 1000) return toast.error("Details must be under 1000 characters");
    setBusy(true);
    const { error } = await supabase.from("reports" as never).insert({
      reporter_id: (await supabase.auth.getUser()).data.user?.id,
      reported_user_id: reportedUserId,
      post_id: postId ?? null,
      reason,
      details: details.trim() || null,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report sent to the OnlyFriends staff");
    setDetails("");
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Flag className="h-5 w-5 text-destructive" /> Report @{username}
          </h2>
          <button onClick={() => onOpenChange(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                reason === r.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={details}
          maxLength={1000}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Anything else the staff should know? (optional)"
          className="mt-3 h-24 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
        />

        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </div>
  );
}
