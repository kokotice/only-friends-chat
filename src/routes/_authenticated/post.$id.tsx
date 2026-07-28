import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Heart, Eye, Play, Send, Trash2, ArrowLeft, Share2 } from "lucide-react";
import { ShareToFriends } from "@/components/ShareToFriends";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/post/$id")({
  component: PostPage,
});

type PostRow = {
  id: string; author_id: string; video_url: string; caption: string | null;
  view_count: number; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
  likes: { user_id: string }[];
};

type CommentRow = {
  id: string; user_id: string; body: string; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
};

function PostPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const { data: post, isLoading } = useQuery<PostRow | null>({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data } = await supabase.from("posts")
        .select("*, profiles!posts_author_profile_fkey(username, display_name), likes(user_id)")
        .eq("id", id).maybeSingle();
      return (data ?? null) as unknown as PostRow | null;
    },
  });

  const { data: comments = [] } = useQuery<CommentRow[]>({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data } = await supabase.from("comments")
        .select("*, profiles!comments_user_profile_fkey(username, display_name)")
        .eq("post_id", id).order("created_at", { ascending: true });
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const [signed, setSigned] = useState<string | null>(null);
  const [viewed, setViewed] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!post) return;
    supabase.storage.from("posts").createSignedUrl(post.video_url, 3600).then(({ data }) => {
      if (data) setSigned(data.signedUrl);
    });
  }, [post?.video_url]);

  // realtime comments
  useEffect(() => {
    const ch = supabase.channel(`comments:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["comments", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!post) return <div className="p-10 text-center text-muted-foreground">Post not found</div>;

  const liked = !!me && post.likes.some((l) => l.user_id === me.id);
  const likeCount = post.likes.length;

  async function toggleLike() {
    if (!me || !post) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", me.id);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: me.id });
    }
    qc.invalidateQueries({ queryKey: ["post", id] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  }

  function onPlay() {
    if (!viewed && post) {
      setViewed(true);
      supabase.rpc("increment_post_view", { p_id: post.id });
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({ post_id: id, user_id: me.id, body: body.trim() });
    setPosting(false);
    if (error) return toast.error(error.message);
    setBody("");
  }

  async function deleteComment(cid: string) {
    await supabase.from("comments").delete().eq("id", cid);
  }

  async function deletePost() {
    if (!post || !me || post.author_id !== me.id) return;
    if (!window.confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    nav({ to: "/feed" });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-8 space-y-4">
        <button onClick={() => window.history.length > 1 ? window.history.back() : nav({ to: "/feed" })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              {(post.profiles?.display_name ?? post.profiles?.username ?? "?")[0].toUpperCase()}
            </div>
            <Link to="/profile/$username" params={{ username: post.profiles?.username ?? "" }} className="text-sm font-semibold hover:underline">
              @{post.profiles?.username}
            </Link>
            {me?.id === post.author_id && (
              <button onClick={deletePost} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
          <div className="relative bg-black aspect-[9/16] max-h-[70vh]">
            {signed ? (
              <video ref={videoRef} src={signed} controls preload="metadata" onPlay={onPlay}
                className="h-full w-full object-contain" playsInline />
            ) : (
              <div className="flex h-full items-center justify-center"><Play className="h-10 w-10 text-muted-foreground animate-pulse" /></div>
            )}
          </div>
          {post.caption && <p className="px-4 pt-3 text-sm">{post.caption}</p>}
          <div className="flex items-center gap-5 p-4 text-sm">
            <button onClick={toggleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} /> {likeCount}
            </button>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-5 w-5" /> {post.view_count}
            </div>
            <button onClick={() => setSharing(true)} className="ml-auto flex items-center gap-1.5 rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">
              <Share2 className="h-4 w-4" /> Share to friends
            </button>
          </div>
        </div>

        {sharing && <ShareToFriends target={{ kind: "post", id: post.id }} onClose={() => setSharing(false)} />}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Comments · {comments.length}
          </h2>
          <div className="space-y-3">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">Be the first to comment.</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                  {(c.profiles?.display_name ?? c.profiles?.username ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <Link to="/profile/$username" params={{ username: c.profiles?.username ?? "" }} className="font-semibold hover:underline">
                      @{c.profiles?.username}
                    </Link>
                    <span className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {me?.id === c.user_id && (
                      <button onClick={() => deleteComment(c.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm break-words">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={submitComment} className="mt-4 flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
              placeholder="Add a comment…"
              className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button type="submit" disabled={posting || !body.trim()}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
