import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Heart, Eye, Play, MessageCircle, Send, Trash2, X, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

type Post = {
  id: string; author_id: string; video_url: string; caption: string | null;
  view_count: number; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
  likes: { user_id: string }[];
  comments: { id: string }[];
};

type CommentRow = {
  id: string; user_id: string; body: string; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
};

function FeedPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["feed"],
    queryFn: async () => {
      const { data } = await supabase.from("posts")
        .select("*, profiles!posts_author_id_fkey(username, display_name), likes(user_id), comments(id)")
        .order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as unknown as Post[];
    },
  });

  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  const onChange = () => qc.invalidateQueries({ queryKey: ["feed"] });

  return (
    <div className="relative h-full bg-black">
      <div
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {posts.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No posts yet. <Link to="/upload" className="text-primary hover:underline">Upload the first one</Link>.
            </div>
          </div>
        ) : posts.map((p) => (
          <ReelSlide
            key={p.id}
            post={p}
            meId={me?.id}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            active={activeId === p.id}
            onActive={() => setActiveId(p.id)}
            onOpenComments={() => setCommentsFor(p.id)}
            onChange={onChange}
          />
        ))}
      </div>

      {commentsFor && (
        <CommentsDrawer
          postId={commentsFor}
          meId={me?.id}
          onClose={() => { setCommentsFor(null); onChange(); }}
        />
      )}
    </div>
  );
}

function ReelSlide({
  post, meId, muted, onToggleMute, active, onActive, onOpenComments, onChange,
}: {
  post: Post; meId?: string; muted: boolean; onToggleMute: () => void;
  active: boolean; onActive: () => void; onOpenComments: () => void; onChange: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [paused, setPaused] = useState(false);
  const liked = !!meId && post.likes.some((l) => l.user_id === meId);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    supabase.storage.from("posts").createSignedUrl(post.video_url, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setError(true); return; }
      setSigned(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [post.video_url]);

  // Intersection observer -> autoplay when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.6) {
            onActive();
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !paused) {
      v.play().catch(() => {});
      if (!viewed) {
        setViewed(true);
        supabase.rpc("increment_post_view", { p_id: post.id });
      }
    } else {
      v.pause();
    }
  }, [active, paused, signed, viewed, post.id]);

  async function toggleLike() {
    if (!meId) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", meId);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: meId });
    }
    onChange();
  }

  return (
    <section
      ref={containerRef}
      className="relative h-full w-full snap-start snap-always"
    >
      <div className="absolute inset-0 flex items-center justify-center bg-black" onClick={() => setPaused((p) => !p)}>
        {signed && !error ? (
          <video
            ref={videoRef}
            src={signed}
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onError={() => setError(true)}
            className="h-full w-full object-contain"
          />
        ) : error ? (
          <div className="text-xs text-muted-foreground">Video unavailable</div>
        ) : (
          <Play className="h-10 w-10 text-muted-foreground animate-pulse" />
        )}
        {paused && signed && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <Play className="h-16 w-16 text-white/80" fill="currentColor" />
          </div>
        )}
      </div>

      {/* Bottom gradient + caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-16 pb-6 px-4">
        <div className="pointer-events-auto flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2 text-white">
            <Link
              to="/profile/$username"
              params={{ username: post.profiles?.username ?? "" }}
              className="inline-block text-sm font-bold hover:underline"
            >
              @{post.profiles?.username}
            </Link>
            {post.caption && <p className="text-sm line-clamp-3">{post.caption}</p>}
          </div>
        </div>
      </div>

      {/* Right rail actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 text-white">
        <button
          onClick={(e) => { e.stopPropagation(); toggleLike(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur ${liked ? "text-primary" : ""}`}>
            <Heart className={`h-6 w-6 ${liked ? "fill-current" : ""}`} />
          </div>
          <span className="text-xs font-semibold">{post.likes.length}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenComments(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">{post.comments?.length ?? 0}</span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Eye className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">{post.view_count}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </section>
  );
}

function CommentsDrawer({ postId, meId, onClose }: { postId: string; meId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: comments = [] } = useQuery<CommentRow[]>({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data } = await supabase.from("comments")
        .select("*, profiles!comments_user_id_fkey(username, display_name)")
        .eq("post_id", postId).order("created_at", { ascending: true });
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`comments-drawer:${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        () => qc.invalidateQueries({ queryKey: ["comments", postId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, qc]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!meId || !body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: meId, body: body.trim() });
    setPosting(false);
    if (error) return toast.error(error.message);
    setBody("");
  }

  async function del(cid: string) {
    await supabase.from("comments").delete().eq("id", cid);
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[75%] flex-col rounded-t-3xl border-t border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Comments · {comments.length}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {comments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Be the first to comment.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                {(c.profiles?.display_name ?? c.profiles?.username ?? "?")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <Link to="/profile/$username" params={{ username: c.profiles?.username ?? "" }} className="font-semibold hover:underline">
                    @{c.profiles?.username}
                  </Link>
                  <span className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {meId === c.user_id && (
                    <button onClick={() => del(c.id)} className="ml-auto text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm break-words">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder="Add a comment…"
            className="flex-1 rounded-full border border-border bg-input px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
