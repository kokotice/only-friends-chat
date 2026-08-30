import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, Radio } from "lucide-react";
import type { ShareTarget } from "./ShareToFriends";

export function SharedMessageCard({ target, mine }: { target: ShareTarget; mine: boolean }) {
  if (target.kind === "post") return <SharedPostCard id={target.id} mine={mine} />;
  return <SharedLiveCard username={target.username} mine={mine} />;
}

function SharedPostCard({ id, mine }: { id: string; mine: boolean }) {
  const { data: post } = useQuery({
    queryKey: ["shared-post", id],
    queryFn: async () => {
      const { data } = await supabase.from("posts")
        .select("id, video_url, caption, profiles!posts_author_profile_fkey(username, display_name)")
        .eq("id", id).maybeSingle();
      return data;
    },
  });
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!post?.video_url) return;
    supabase.storage.from("posts").createSignedUrl(post.video_url, 3600).then(({ data }) => {
      if (data) setThumb(data.signedUrl);
    });
  }, [post?.video_url]);

  const border = mine ? "border-primary-foreground/30" : "border-border";
  if (!post) {
    return <div className={`rounded-xl border ${border} bg-black/20 p-3 text-xs opacity-70`}>Shared post unavailable</div>;
  }
  return (
    <Link
      to="/post/$id"
      params={{ id }}
      className={`block overflow-hidden rounded-xl border ${border} bg-black/30 transition-transform hover:scale-[1.01]`}
    >
      <div className="relative aspect-[9/16] max-h-64 bg-black">
        {thumb ? (
          <video src={thumb} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center"><Play className="h-8 w-8 opacity-60" /></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60"><Play className="h-5 w-5" fill="currentColor" /></div>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-xs font-semibold">@{post.profiles?.username}</div>
        {post.caption && <div className="mt-0.5 line-clamp-2 text-xs opacity-80">{post.caption}</div>}
      </div>
    </Link>
  );
}

function SharedLiveCard({ username, mine }: { username: string; mine: boolean }) {
  const border = mine ? "border-primary-foreground/30" : "border-border";
  return (
    <Link
      to="/live"
      className={`flex items-center gap-3 rounded-xl border ${border} bg-black/30 p-3 hover:bg-black/40`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
        <Radio className="h-5 w-5 animate-pulse" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-destructive">Live stream</div>
        <div className="truncate text-sm font-medium">@{username} is live — tap to watch</div>
      </div>
    </Link>
  );
}
