import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFriends, getMyProfile } from "@/lib/queries";
import { Send, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: MessagesPage,
});

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };
type Friend = { id: string; username: string; display_name: string | null; avatar_url: string | null };

function MessagesPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends", me?.id],
    queryFn: () => (me ? getFriends(me.id) : Promise.resolve([])),
    enabled: !!me,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = friends.find((f) => f.id === activeId);

  useEffect(() => {
    if (!activeId && friends.length) setActiveId(friends[0].id);
  }, [friends, activeId]);

  return (
    <div className="flex h-full">
      <div className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-72 flex-col border-r border-border bg-card/40`}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold">Friends</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Mutual subs only</p>
        </div>
        {friends.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No friends yet. <button onClick={() => nav({ to: "/discover" })} className="text-primary hover:underline">Find people</button> to subscribe to.
          </div>
        ) : (
          <div className="overflow-y-auto">
            {friends.map((f) => (
              <button key={f.id} onClick={() => setActiveId(f.id)} className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${activeId === f.id ? "bg-primary/10" : "hover:bg-accent"}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold shrink-0">
                  {(f.display_name ?? f.username)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.display_name ?? f.username}</div>
                  <div className="truncate text-xs text-muted-foreground">@{f.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {active && me ? <ChatView me={me.id} other={active} onBack={() => setActiveId(null)} onSent={() => qc.invalidateQueries({ queryKey: ["msgs"] })} /> : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="mx-auto h-10 w-10 opacity-40" />
              <p className="mt-4 text-sm">Select a friend to chat</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatView({ me, other, onSent, onBack }: { me: string; other: Friend; onSent: () => void; onBack: () => void }) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery<Msg[]>({
    queryKey: ["msgs", me, other.id],
    queryFn: async () => {
      const { data } = await supabase.from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${me})`)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as Msg[];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const channel = supabase.channel(`msgs:${me}:${other.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => onSent())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, other.id, onSent]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: other.id, content });
    if (error) toast.error(error.message);
    else onSent();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-primary text-sm">←</button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
            {(other.display_name ?? other.username)[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{other.display_name ?? other.username}</div>
            <div className="text-xs text-muted-foreground truncate">@{other.username}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">Say hi 👋</div>}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-border p-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message @${other.username}`}
          className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary" />
        <button className="rounded-full bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
