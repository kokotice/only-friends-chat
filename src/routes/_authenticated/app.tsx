import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getFriends, getMyProfile } from "@/lib/queries";
import { Send, Search, Users, Plus, X, UserPlus, Sparkles, Trash2 } from "lucide-react";
import { parseShare } from "@/components/ShareToFriends";
import { SharedMessageCard } from "@/components/SharedMessageCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: MessagesPage,
});

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };
type Friend = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type Group = { id: string; name: string; owner_id: string; seat_limit: number };
type GroupMsg = {
  id: string; group_id: string; sender_id: string; content: string; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
};

const SEAT_PRICE = 10000;

function MessagesPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends", me?.id],
    queryFn: () => (me ? getFriends(me.id) : Promise.resolve([])),
    enabled: !!me,
  });
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["groups", me?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("id, name, owner_id, seat_limit")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Group[];
    },
    enabled: !!me,
  });

  // Conversations = mutual friends + anyone you already exchanged DMs with,
  // sorted by the most recent message so open chats are never hidden.
  const { data: convos = [] } = useQuery<(Friend & { lastAt: string | null })[]>({
    queryKey: ["dm-convos", me?.id, friends.map((f) => f.id).join(",")],
    enabled: !!me,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const last = new Map<string, string>();
      for (const m of msgs ?? []) {
        const peer = m.sender_id === me!.id ? m.recipient_id : m.sender_id;
        if (peer !== me!.id && !last.has(peer)) last.set(peer, m.created_at);
      }
      const known = new Map(friends.map((f) => [f.id, f]));
      const missing = [...last.keys()].filter((id) => !known.has(id));
      if (missing.length) {
        const { data: extra } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", missing);
        for (const p of (extra ?? []) as Friend[]) known.set(p.id, p);
      }
      return [...known.values()]
        .map((f) => ({ ...f, lastAt: last.get(f.id) ?? null }))
        .sort((a, b) => {
          if (a.lastAt && b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
          if (a.lastAt) return -1;
          if (b.lastAt) return 1;
          return (a.display_name ?? a.username).localeCompare(b.display_name ?? b.username);
        });
    },
  });

  const [tab, setTab] = useState<"friends" | "groups">("friends");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const active = convos.find((f) => f.id === activeId);
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const hasOpenChat = tab === "friends" ? !!activeId : !!activeGroupId;

  useEffect(() => {
    if (tab === "friends" && !activeId && convos.length) setActiveId(convos[0]!.id);
  }, [convos, activeId, tab]);


  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await supabase.rpc("create_group", { _name: name });
    if (error) return toast.error(error.message);
    setNewName("");
    setCreating(false);
    await qc.invalidateQueries({ queryKey: ["groups"] });
    setActiveGroupId(data as string);
    toast.success("Group created");
  }

  return (
    <div className="flex h-full">
      <div className={`${hasOpenChat ? "hidden md:flex" : "flex"} w-full md:w-72 flex-col border-r border-border bg-card/40`}>
        <div className="flex gap-1 p-2 border-b border-border">
          <button onClick={() => { setTab("friends"); setActiveGroupId(null); }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === "friends" ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}>
            Friends
          </button>
          <button onClick={() => { setTab("groups"); setActiveId(null); }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${tab === "groups" ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}>
            Groups
          </button>
        </div>

        {tab === "friends" ? (
          friends.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No friends yet. <button onClick={() => nav({ to: "/discover" })} className="text-primary hover:underline">Find people</button> to subscribe to.
            </div>
          ) : (
            <div className="overflow-y-auto">
              {friends.map((f) => (
                <button key={f.id} onClick={() => setActiveId(f.id)} className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${activeId === f.id ? "bg-primary/10" : "hover:bg-accent"}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold shrink-0">
                    {(f.display_name ?? f.username)[0]!.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.display_name ?? f.username}</div>
                    <div className="truncate text-xs text-muted-foreground">@{f.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-3">
              {creating ? (
                <form onSubmit={createGroup} className="flex gap-2">
                  <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40}
                    placeholder="Group name" className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Add</button>
                </form>
              ) : (
                <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4" /> New group
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {groups.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No groups yet. Create one and invite up to 25 friends.</p>
              )}
              {groups.map((g) => (
                <button key={g.id} onClick={() => setActiveGroupId(g.id)} className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${activeGroupId === g.id ? "bg-primary/10" : "hover:bg-accent"}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{g.seat_limit} seats</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`${hasOpenChat ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {tab === "friends" && active && me ? (
          <ChatView me={me.id} other={active} onBack={() => setActiveId(null)} onSent={() => qc.invalidateQueries({ queryKey: ["msgs"] })} />
        ) : tab === "groups" && activeGroup && me ? (
          <GroupChatView me={me.id} group={activeGroup} friends={friends} onBack={() => setActiveGroupId(null)} />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="mx-auto h-10 w-10 opacity-40" />
              <p className="mt-4 text-sm">{tab === "friends" ? "Select a friend to chat" : "Select or create a group"}</p>
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
            {(other.display_name ?? other.username)[0]!.toUpperCase()}
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
          const share = parseShare(m.content);
          const text = share ? m.content.replace(/\[\[share:(post|live):[^\]]+\]\]/, "").trim() : m.content;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] space-y-2 rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                {text && <div className="px-1 whitespace-pre-wrap break-words">{text}</div>}
                {share && <SharedMessageCard target={share} mine={mine} />}
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

function GroupChatView({ me, group, friends, onBack }: { me: string; group: Group; friends: Friend[]; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [managing, setManaging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isOwner = group.owner_id === me;

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members")
        .select("user_id, profiles!group_members_user_profile_fkey(id, username, display_name, avatar_url)")
        .eq("group_id", group.id);
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; profiles: Friend | null }[];
    },
  });

  const { data: messages = [] } = useQuery<GroupMsg[]>({
    queryKey: ["group-msgs", group.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_messages")
        .select("*, profiles!group_messages_sender_profile_fkey(username, display_name)")
        .eq("group_id", group.id).order("created_at", { ascending: true }).limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as GroupMsg[];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const ch = supabase.channel(`group:${group.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        () => qc.invalidateQueries({ queryKey: ["group-msgs", group.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    const { error } = await supabase.from("group_messages").insert({ group_id: group.id, sender_id: me, content });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["group-msgs", group.id] });
  }

  async function addMember(userId: string) {
    const { error } = await supabase.rpc("group_add_member", { _group_id: group.id, _user_id: userId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["group-members", group.id] });
    toast.success("Added to the group");
  }

  async function removeMember(userId: string) {
    const { error } = await supabase.from("group_members").delete().eq("group_id", group.id).eq("user_id", userId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["group-members", group.id] });
  }

  async function buySeat() {
    const { error } = await supabase.rpc("group_buy_seat", { _group_id: group.id });
    if (error) return toast.error(error.message);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["groups"] }),
      qc.invalidateQueries({ queryKey: ["my-profile"] }),
    ]);
    toast.success(`+1 seat for ${SEAT_PRICE.toLocaleString()} 💖`);
  }

  const memberIds = new Set(members.map((m) => m.user_id));
  const addable = friends.filter((f) => !memberIds.has(f.id));
  const full = members.length >= group.seat_limit;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 md:px-6 py-3 md:py-4">
        <button onClick={onBack} className="md:hidden text-primary text-sm">←</button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{group.name}</div>
          <div className="text-xs text-muted-foreground">{members.length}/{group.seat_limit} members</div>
        </div>
        <button onClick={() => setManaging(true)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
          Members
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2">
        {messages.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">No messages yet — say hi 👋</div>}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          const share = parseShare(m.content);
          const body = share ? m.content.replace(/\[\[share:(post|live):[^\]]+\]\]/, "").trim() : m.content;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] space-y-1 rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                {!mine && (
                  <div className="px-1 text-xs font-semibold opacity-70">
                    {m.profiles?.display_name ?? m.profiles?.username ?? "someone"}
                  </div>
                )}
                {body && <div className="px-1 whitespace-pre-wrap break-words">{body}</div>}
                {share && <SharedMessageCard target={share} mine={mine} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-border p-4">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${group.name}`}
          className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary" />
        <button className="rounded-full bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-50" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>

      {managing && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 md:items-center" onClick={() => setManaging(false)}>
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{group.name} · {members.length}/{group.seat_limit}</h2>
              <button onClick={() => setManaging(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 max-h-52 space-y-1 overflow-y-auto">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <span className="flex-1 truncate">
                    @{m.profiles?.username ?? "user"}{m.user_id === group.owner_id && <span className="ml-1 text-xs text-primary">owner</span>}
                  </span>
                  {isOwner && m.user_id !== group.owner_id && (
                    <button onClick={() => removeMember(m.user_id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isOwner && (
              <>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Add mutual friends</p>
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                    {addable.length === 0 && <p className="text-xs text-muted-foreground">All your friends are already here.</p>}
                    {addable.map((f) => (
                      <button key={f.id} onClick={() => addMember(f.id)} disabled={full}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-40">
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">@{f.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={buySeat} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  <Sparkles className="h-4 w-4" /> Buy +1 seat · {SEAT_PRICE.toLocaleString()} 💖
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Groups hold 25 people for free. Each extra person costs {SEAT_PRICE.toLocaleString()} sparks.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
