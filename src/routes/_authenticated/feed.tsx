import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Heart, Eye, Play, MessageCircle, Send, Trash2, X, Volume2, VolumeX, Share2, Loader2 } from "lucide-react";
import { ShareToFriends } from "@/components/ShareToFriends";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

const PAGE_SIZE = 8;

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
  comment_likes: { user_id: string }[];
};

function FeedPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["feed"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const { data, error } = await supabase.from("posts")
        .select("*, profiles!posts_author_profile_fkey(username, display_name), likes(user_id), comments(id)")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
  });

  const posts = useMemo(() => data?.pages.flat() ?? [], [data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [index, setIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  const onChange = useCallback(() => qc.invalidateQueries({ queryKey: ["feed"] }), [qc]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientHeight === 0) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    setIndex((prev) => (prev === i ? prev : i));
    // prefetch more when close to the end
    if (i >= posts.length - 3 && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [posts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loop back to the first reel once the last one finishes / user scrolls past it
  const restart = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
    setIndex(0);
  }, []);

  return (
    <div className="relative h-full bg-black">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain"
        style={{ scrollbarWidth: "none" }}
      >
        {posts.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6">
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              {isLoading ? (
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              ) : (
                <>No posts yet. <Link to="/upload" className="text-primary hover:underline">Upload the first one</Link>.</>
              )}
            </div>
          </div>
        ) : posts.map((p, i) => (
          <ReelSlide
            key={p.id}
            post={p}
            meId={me?.id}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            active={i === index}
            near={Math.abs(i - index) <= 1}
            isLast={i === posts.length - 1 && !hasNextPage}
            onEnded={restart}
            onOpenComments={() => setCommentsFor(p.id)}
            onChange={onChange}
          />
        ))}

        {isFetchingNextPage && (
          <div className="flex h-16 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          {Math.min(index + 1, posts.length)} / {posts.length}{hasNextPage ? "+" : ""}
        </div>
      )}

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
  post, meId, muted, onToggleMute, active, near, isLast, onEnded, onOpenComments, onChange,
}: {
  post: Post; meId?: string; muted: boolean; onToggleMute: () => void;
  active: boolean; near: boolean; isLast: boolean; onEnded: () => void;
  onOpenComments: () => void; onChange: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const liked = !!meId && post.likes.some((l) => l.user_id === meId);

  // Resolve a signed URL only when the slide is near the viewport (avoids
  // hundreds of parallel storage calls, which was the main playback bug).
  useEffect(() => {
    if (!near || signed) return;
    let cancelled = false;
    setError(false);
    supabase.storage.from("posts").createSignedUrl(post.video_url, 60 * 60 * 6).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.signedUrl) { setError(true); return; }
      setSigned(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [near, signed, post.video_url]);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !paused) {
      v.play().catch(() => {});
      if (!viewed) {
        setViewed(true);
        supabase.rpc("increment_post_view", { p_id: post.id }).then(() => onChange());
      }
    } else {
      v.pause();
      if (!active) { try { v.currentTime = 0; } catch { /* noop */ } }
    }
  }, [active, paused, signed, viewed, post.id, onChange]);

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
    <section className="relative h-full w-full shrink-0 snap-start snap-always">
      <div className="absolute inset-0 flex items-center justify-center bg-black" onClick={() => setPaused((p) => !p)}>
        {signed && !error ? (
          <video
            ref={videoRef}
            src={signed}
            loop={!isLast}
            muted={muted}
            playsInline
            preload={near ? "auto" : "none"}
            onEnded={() => { if (isLast) onEnded(); }}
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
        <button
          onClick={(e) => { e.stopPropagation(); setSharing(true); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Share2 className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">Share</span>
        </button>
        <div className="flex flex-col items-center gap-1" title="Unique viewers">
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

      {sharing && (
        <ShareToFriends target={{ kind: "post", id: post.id }} onClose={() => setSharing(false)} />
      )}
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
        .select("*, profiles!comments_user_profile_fkey(username, display_name), comment_likes(user_id)")
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
    qc.invalidateQueries({ queryKey: ["comments", postId] });
  }

  async function del(cid: string) {
    await supabase.from("comments").delete().eq("id", cid);
    qc.invalidateQueries({ queryKey: ["comments", postId] });
  }

  async function toggleCommentLike(c: CommentRow) {
    if (!meId) return;
    const mine = c.comment_likes?.some((l) => l.user_id === meId);
    if (mine) {
      await supabase.from("comment_likes").delete().eq("comment_id", c.id).eq("user_id", meId);
    } else {
      const { error } = await supabase.from("comment_likes").insert({ comment_id: c.id, user_id: meId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["comments", postId] });
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
          {comments.map((c) => {
            const likeCount = c.comment_likes?.length ?? 0;
            const mine = !!meId && (c.comment_likes ?? []).some((l) => l.user_id === meId);
            return (
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
                <button
                  onClick={() => toggleCommentLike(c)}
                  className={`flex shrink-0 flex-col items-center gap-0.5 self-start pt-1 text-xs ${mine ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label="Like comment"
                >
                  <Heart className={`h-4 w-4 ${mine ? "fill-current" : ""}`} />
                  {likeCount > 0 && <span>{likeCount}</span>}
                </button>
              </div>
            );
          })}
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
