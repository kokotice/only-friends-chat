import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFriends, getMyProfile } from "@/lib/queries";
import { X, Send, Check } from "lucide-react";
import { toast } from "sonner";

type Friend = { id: string; username: string; display_name: string | null };

export type ShareTarget =
  | { kind: "post"; id: string; label?: string }
  | { kind: "live"; username: string; label?: string };

export function shareToken(target: ShareTarget): string {
  if (target.kind === "post") return `[[share:post:${target.id}]]`;
  return `[[share:live:${target.username}]]`;
}

/** Parses a message body and returns a share target if present. */
export function parseShare(content: string): ShareTarget | null {
  const m = content.match(/\[\[share:(post|live):([^\]]+)\]\]/);
  if (!m) return null;
  if (m[1] === "post") return { kind: "post", id: m[2] };
  return { kind: "live", username: m[2] };
}

export function ShareToFriends({ target, onClose, onShared }: { target: ShareTarget; onClose: () => void; onShared?: () => void }) {
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends", me?.id],
    queryFn: () => (me ? getFriends(me.id) : Promise.resolve([])),
    enabled: !!me,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function send() {
    if (!me || selected.size === 0) return;
    setSending(true);
    const token = shareToken(target);
    const content = note.trim() ? `${note.trim()}\n${token}` : token;
    const rows = [...selected].map((rid) => ({ sender_id: me.id, recipient_id: rid, content }));
    const { error } = await supabase.from("messages").insert(rows);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Shared with ${selected.size} friend${selected.size > 1 ? "s" : ""}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 p-0 md:p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl md:rounded-3xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold">Share to friends</h2>
            <p className="text-xs text-muted-foreground">
              {target.kind === "post" ? "Send this reel in DMs" : `Invite friends to watch @${target.username}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {friends.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No friends yet — mutual subscribers appear here.
            </p>
          ) : friends.map((f) => {
            const on = selected.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors ${on ? "bg-primary/15" : "hover:bg-accent"}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                  {(f.display_name ?? f.username)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.display_name ?? f.username}</div>
                  <div className="truncate text-xs text-muted-foreground">@{f.username}</div>
                </div>
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {on && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })}
        </div>

        {friends.length > 0 && (
          <div className="border-t border-border p-4 space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              maxLength={200}
              className="w-full rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={sending || selected.size === 0}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : `Send${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
