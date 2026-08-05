import { createFileRoute, Link } from "@tanstack/react-router";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Heart, Eye, Play, MessageCircle, Send, Trash2, X, Volume2, VolumeX, Share2, Loader2, UserPlus, UserCheck, Sparkles } from "lucide-react";
import { ShareToFriends } from "@/components/ShareToFriends";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

const PAGE_SIZE = 8;

type Post = {
  id: string; author_id: string; video_url: string; caption: string | null;
  view_count: number; created_at: string;
  username: string | null; display_name: string | null;
  like_count: number; comment_count: number; share_count: number;
  liked_by_me: boolean; subscribed: boolean;
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
      const offset = (pageParam as number) * PAGE_SIZE;
      const { data, error } = await supabase.rpc("feed_ranked", { _limit: PAGE_SIZE, _offset: offset });
      if (error) throw error;
      return (data ?? []) as unknown as Post[];
    },
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
  });

  const posts = useMemo(() => data?.pages.flat() ?? [], [data]);

  // Batch-sign URLs for a window of upcoming posts in ONE request so the next
  // videos are already resolvable before they scroll into view.
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());

  const scrollRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [index, setIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  // Patch posts in the cache instead of refetching the whole ranked feed —
  // a full invalidate re-renders every slide and reshuffles the order.
  const patchPosts = useCallback(
    (match: (p: Post) => boolean, patch: (p: Post) => Post) =>
      qc.setQueryData<InfiniteData<Post[]>>(["feed"], (old) =>
        old
          ? { ...old, pages: old.pages.map((pg) => pg.map((p) => (match(p) ? patch(p) : p))) }
          : old,
      ),
    [qc],
  );
  const patchPost = useCallback(
    (id: string, patch: (p: Post) => Post) => patchPosts((p) => p.id === id, patch),
    [patchPosts],
  );
  const patchAuthor = useCallback(
    (authorId: string, patch: (p: Post) => Post) => patchPosts((p) => p.author_id === authorId, patch),
    [patchPosts],
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const openComments = useCallback((id: string) => setCommentsFor(id), []);
  const closeComments = useCallback(() => setCommentsFor(null), []);
  const syncCommentCount = useCallback(
    (n: number) => {
      if (!commentsFor) return;
      patchPost(commentsFor, (p) => (p.comment_count === n ? p : { ...p, comment_count: n }));
    },
    [commentsFor, patchPost],
  );

  // Track which slide is actually on screen with an IntersectionObserver.
  const slideEls = useRef(new Map<number, HTMLElement>());
  const ratios = useRef(new Map<number, number>());

  const registerSlide = useCallback((i: number, el: HTMLElement | null) => {
    if (el) slideEls.current.set(i, el);
    else { slideEls.current.delete(i); ratios.current.delete(i); }
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || posts.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset["idx"]);
          ratios.current.set(i, e.intersectionRatio);
        }
        let best = -1, bestRatio = 0;
        ratios.current.forEach((r, i) => { if (r > bestRatio) { bestRatio = r; best = i; } });
        if (best >= 0 && bestRatio >= 0.5) setIndex((prev) => (prev === best ? prev : best));
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    slideEls.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [posts.length]);

  useEffect(() => {
    if (posts.length === 0) return;
    const window = posts.slice(Math.max(0, index - 1), index + 5).map((p) => p.video_url);
    const missing = [...new Set(window.filter((u) => u && !requested.current.has(u)))];
    if (missing.length === 0) return;
    missing.forEach((u) => requested.current.add(u));
    let cancelled = false;
    supabase.storage.from("posts").createSignedUrls(missing, 60 * 60 * 6).then(({ data }) => {
      if (cancelled || !data) return;
      const next: Record<string, string> = {};
      for (const row of data) if (row.path && row.signedUrl) next[row.path] = row.signedUrl;
      if (Object.keys(next).length) setUrls((prev) => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, [index, posts]);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && index >= posts.length - 3) fetchNextPage();
  }, [index, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
            idx={i}
            registerSlide={registerSlide}
            post={p}
            src={urls[p.video_url]}
            meId={me?.id}
            muted={muted}
            onToggleMute={toggleMute}
            active={i === index}
            near={i - index >= -1 && i - index <= 2}
            isLast={i === posts.length - 1 && !hasNextPage}
            onEnded={restart}
            onOpenComments={openComments}
            patchPost={patchPost}
            patchAuthor={patchAuthor}
          />
        ))}

        {isFetchingNextPage && (
          <div className="flex h-16 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {Math.min(index + 1, posts.length)} / {posts.length}{hasNextPage ? "+" : ""}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-primary/25 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
            <Sparkles className="h-3 w-3" /> For you
          </span>
        </div>
      )}

      {commentsFor && (
        <CommentsDrawer
          postId={commentsFor}
          meId={me?.id}
          onCountChange={syncCommentCount}
          onClose={closeComments}
        />
      )}
    </div>
  );
}

const ReelSlide = memo(function ReelSlide({
  post, src, meId, muted, onToggleMute, active, near, isLast, onEnded, onOpenComments, patchPost, patchAuthor,
  idx, registerSlide,
}: {
  post: Post; src?: string; meId?: string; muted: boolean; onToggleMute: () => void;
  active: boolean; near: boolean; isLast: boolean; onEnded: () => void;
  onOpenComments: (id: string) => void;
  patchPost: (id: string, patch: (p: Post) => Post) => void;
  patchAuthor: (authorId: string, patch: (p: Post) => Post) => void;
  idx: number; registerSlide: (i: number, el: HTMLElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const signed = src ?? null;
  const viewedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const liked = post.liked_by_me;
  const isMine = meId === post.author_id;

  useEffect(() => { setError(false); }, [src]);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !paused) {
      v.play().catch(() => {});
      if (!viewedRef.current) {
        viewedRef.current = true;
        supabase.rpc("increment_post_view", { p_id: post.id }).then(() =>
          patchPost(post.id, (p) => ({ ...p, view_count: p.view_count + 1 })),
        );
      }
    } else {
      v.pause();
      if (!active) { try { v.currentTime = 0; } catch { /* noop */ } }
    }
  }, [active, paused, signed, post.id, patchPost]);

  async function toggleLike() {
    if (!meId) return;
    patchPost(post.id, (p) => ({
      ...p,
      liked_by_me: !liked,
      like_count: Math.max(0, p.like_count + (liked ? -1 : 1)),
    }));
    const { error } = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", meId)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: meId });
    if (error) {
      patchPost(post.id, (p) => ({
        ...p,
        liked_by_me: liked,
        like_count: Math.max(0, p.like_count + (liked ? 1 : -1)),
      }));
      toast.error(error.message);
    }
  }

  async function toggleSubscribe() {
    if (!meId || isMine) return;
    setSubBusy(true);
    const was = post.subscribed;
    patchAuthor(post.author_id, (p) => ({ ...p, subscribed: !was }));
    const { error } = was
      ? await supabase.from("subscriptions").delete().eq("subscriber_id", meId).eq("subscribed_to_id", post.author_id)
      : await supabase.from("subscriptions").insert({ subscriber_id: meId, subscribed_to_id: post.author_id });
    setSubBusy(false);
    if (error) {
      patchAuthor(post.author_id, (p) => ({ ...p, subscribed: was }));
      return toast.error(error.message);
    }
    toast.success(was ? "Unsubscribed" : `Subscribed to @${post.username} — more of them in your feed`);
  }

  return (
    <section
      ref={(el) => registerSlide(idx, el)}
      data-idx={idx}
      className="relative h-full w-full shrink-0 snap-start snap-always"
    >
      <div className="absolute inset-0 flex items-center justify-center bg-black" onClick={() => setPaused((p) => !p)}>
        {signed && !error ? (
          <video
            ref={videoRef}
            src={signed}
            loop={!isLast}
            muted={muted}
            playsInline
            preload={active || near ? "auto" : "metadata"}
            // eslint-disable-next-line react/no-unknown-property
            disablePictureInPicture
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
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/profile/$username"
                params={{ username: post.username ?? "" }}
                className="text-sm font-bold hover:underline"
              >
                @{post.username}
              </Link>
              {!isMine && meId && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSubscribe(); }}
                  disabled={subBusy}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    post.subscribed
                      ? "bg-white/15 text-white backdrop-blur"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {post.subscribed ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  {post.subscribed ? "Subscribed" : "Subscribe"}
                </button>
              )}
            </div>
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
          <span className="text-xs font-semibold">{post.like_count}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenComments(post.id); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">{post.comment_count}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setSharing(true); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Share2 className="h-6 w-6" />
          </div>
          <span className="text-xs font-semibold">{post.share_count}</span>
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
        <ShareToFriends
          target={{ kind: "post", id: post.id }}
          onShared={() => patchPost(post.id, (p) => ({ ...p, share_count: p.share_count + 1 }))}
          onClose={() => setSharing(false)}
        />
      )}
    </section>
  );
});

function CommentsDrawer({ postId, meId, onClose, onCountChange }: { postId: string; meId?: string; onClose: () => void; onCountChange: (n: number) => void }) {
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

  const count = comments.length;
  useEffect(() => { onCountChange(count); }, [count, onCountChange]);

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
