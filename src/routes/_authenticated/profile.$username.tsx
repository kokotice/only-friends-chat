import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getProfileByUsername, getSubscriptionStatus } from "@/lib/queries";
import { UserAvatar } from "@/components/UserAvatar";
import { toast } from "sonner";
import { UserPlus, UserMinus, MessageCircle, Users, Sparkles, Zap, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/$username")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: profile, isLoading } = useQuery({ queryKey: ["profile", username], queryFn: () => getProfileByUsername(username) });
  const { data: subStatus } = useQuery({
    queryKey: ["sub", me?.id, profile?.id],
    queryFn: () => (me && profile ? getSubscriptionStatus(me.id, profile.id) : null),
    enabled: !!me && !!profile && me.id !== profile.id,
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from("posts").select("*, likes(user_id)").eq("author_id", profile.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile,
  });
  const { data: subCount = 0 } = useQuery({
    queryKey: ["subcount", profile?.id],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("subscribed_to_id", profile.id);
      return count ?? 0;
    },
    enabled: !!profile,
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!profile) return <div className="p-10 text-center text-muted-foreground">User not found</div>;

  const isMe = me?.id === profile.id;

  async function toggleSub() {
    if (!me || !profile) return;
    if (subStatus?.iSubscribe) {
      await supabase.from("subscriptions").delete().eq("subscriber_id", me.id).eq("subscribed_to_id", profile.id);
    } else {
      const { error } = await supabase.from("subscriptions").insert({ subscriber_id: me.id, subscribed_to_id: profile.id });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["sub"] });
    qc.invalidateQueries({ queryKey: ["subcount"] });
    qc.invalidateQueries({ queryKey: ["friends"] });
  }

  async function tip() {
    if (!me || !profile) return;
    const raw = window.prompt(`Tip @${profile.username} how many 💖?`, "10");
    if (!raw) return;
    const amt = parseInt(raw, 10);
    if (!amt || amt < 1) return toast.error("Bad amount");
    const { error } = await supabase.rpc("tip_user", { _to: profile.id, _amount: amt });
    if (error) return toast.error(error.message);
    toast.success(`Tipped ${amt} 💖 to @${profile.username}`);
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  }

  const boosted = profile.boost_until && new Date(profile.boost_until) > new Date();

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative h-32 md:h-40 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
      <div className="mx-auto max-w-3xl px-4 md:px-6 -mt-14 md:-mt-16 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <UserAvatar path={profile.avatar_url} name={profile.display_name ?? profile.username}
            className="h-24 w-24 md:h-28 md:w-28 border-4 border-background bg-primary/30 text-3xl shrink-0" />
          {!isMe && subStatus && (
            <div className="flex flex-wrap gap-2">
              <button onClick={toggleSub} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${subStatus.iSubscribe ? "border border-border" : "bg-primary text-primary-foreground"}`}>
                {subStatus.iSubscribe ? <><UserMinus className="h-4 w-4" /> Unsub</> : <><UserPlus className="h-4 w-4" /> Subscribe</>}
              </button>
              <button onClick={tip} className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" /> Tip
              </button>
              {subStatus.friends && (
                <button onClick={() => nav({ to: "/app" })} className="flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary">
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{profile.display_name ?? profile.username}</h1>
            {boosted && <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary"><Zap className="h-3 w-3" /> Boosted</span>}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {subCount} subscribers</span>
            <span>{posts.length} posts</span>
          </div>
          {!isMe && subStatus && !subStatus.friends && (
            <p className="mt-3 text-xs text-muted-foreground">
              {subStatus.iSubscribe && !subStatus.theySubscribe && "Waiting for them to subscribe back to unlock DMs."}
              {!subStatus.iSubscribe && subStatus.theySubscribe && "They subscribed to you. Subscribe back to unlock DMs."}
              {!subStatus.iSubscribe && !subStatus.theySubscribe && "Both must subscribe to each other to unlock DMs."}
            </p>
          )}
        </div>
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Posts</h2>
          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {posts.map((p) => (
                <Link key={p.id} to="/post/$id" params={{ id: p.id }}>
                  <ThumbTile path={p.video_url} likes={p.likes.length} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
function ThumbTile({ path, likes }: { path: string; likes: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    supabase.storage.from("posts").createSignedUrl(path, 3600).then(({ data, error }) => {
      if (error || !data) { setError(true); return; }
      setUrl(data.signedUrl);
    });
  }, [path]);
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black group">
      {url && !error ? (
        <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" onError={() => setError(true)} />
      ) : (
        <div className="flex h-full items-center justify-center"><Play className="h-6 w-6 text-muted-foreground" /></div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
      <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs">♥ {likes}</div>
    </div>
  );
}
