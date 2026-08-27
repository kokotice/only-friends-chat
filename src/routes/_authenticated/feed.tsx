import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/queries";
import { Heart, Eye, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

type Post = {
  id: string; author_id: string; video_url: string; caption: string | null;
  view_count: number; created_at: string;
  profiles: { username: string; display_name: string | null } | null;
  likes: { user_id: string }[];
};

function FeedPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });
  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ["feed"],
    queryFn: async () => {
      const { data } = await supabase.from("posts")
        .select("*, profiles!posts_author_id_fkey(username, display_name), likes(user_id)")
        .order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as unknown as Post[];
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg py-8 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Feed</h1>
          <p className="text-sm text-muted-foreground">Latest reels from the community</p>
        </div>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No posts yet. <Link to="/upload" className="text-primary hover:underline">Upload the first one</Link>.
          </div>
        ) : posts.map((p) => (
          <PostCard key={p.id} post={p} meId={me?.id} onChange={() => qc.invalidateQueries({ queryKey: ["feed"] })} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, meId, onChange }: { post: Post; meId?: string; onChange: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [signed, setSigned] = useState<string | null>(null);
  const [viewed, setViewed] = useState(false);
  const liked = !!meId && post.likes.some((l) => l.user_id === meId);
  const likeCount = post.likes.length;

  useEffect(() => {
    // extract storage path from video_url — we stored the path directly
    supabase.storage.from("posts").createSignedUrl(post.video_url, 3600).then(({ data }) => {
      if (data) setSigned(data.signedUrl);
    });
  }, [post.video_url]);

  async function toggleLike() {
    if (!meId) return;
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", meId);
    } else {
      await supabase.from("likes").insert({ post_id: post.id, user_id: meId });
    }
    onChange();
  }

  function onPlay() {
    if (!viewed) {
      setViewed(true);
      supabase.rpc("increment_post_view", { p_id: post.id });
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
          {(post.profiles?.display_name ?? post.profiles?.username ?? "?")[0].toUpperCase()}
        </div>
        <Link to="/profile/$username" params={{ username: post.profiles?.username ?? "" }} className="text-sm font-semibold hover:underline">
          @{post.profiles?.username}
        </Link>
      </div>
      <div className="relative bg-black aspect-[9/16] max-h-[600px]">
        {signed ? (
          <video ref={videoRef} src={signed} controls onPlay={onPlay} className="h-full w-full object-contain" playsInline />
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
      </div>
    </div>
  );
}
