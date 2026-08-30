import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Eye, Heart, Share2, Trophy, Users, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
  head: () => ({
    meta: [
      { title: "Leaderboards · OnlyFriends" },
      { name: "description", content: "Top 10 most viewed, most liked and most shared reels on OnlyFriends, plus the creators with the most subscribers." },
      { property: "og:title", content: "OnlyFriends Leaderboards" },
      { property: "og:description", content: "See which reels and creators are winning on OnlyFriends right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TopPost = {
  id: string; author_id: string; caption: string | null; created_at: string;
  username: string | null; display_name: string | null; avatar_url: string | null;
  view_count: number; like_count: number; share_count: number; metric_value: number;
};

type TopCreator = {
  id: string; username: string; display_name: string | null; avatar_url: string | null;
  subscriber_count: number; subscribed_by_me: boolean;
};

const METRICS = [
  { key: "views", label: "Most viewed", icon: Eye },
  { key: "likes", label: "Most liked", icon: Heart },
  { key: "shares", label: "Most shared", icon: Share2 },
] as const;

function medal(i: number) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
}

function LeaderboardPage() {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("views");

  const { data: posts = [], isLoading } = useQuery<TopPost[]>({
    queryKey: ["top-posts", metric],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("top_posts", { _metric: metric });
      if (error) throw error;
      return (data ?? []) as unknown as TopPost[];
    },
  });

  const { data: creators = [] } = useQuery<TopCreator[]>({
    queryKey: ["top-creators"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("top_creators");
      if (error) throw error;
      return (data ?? []) as unknown as TopCreator[];
    },
  });

  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10 space-y-8">
        <header className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-black">Leaderboards</h1>
            <p className="text-xs text-muted-foreground">The top 10 reels and creators on OnlyFriends.</p>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  metric === m.key ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {isLoading && (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            )}
            {!isLoading && posts.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No reels yet.</p>
            )}
            {posts.map((p, i) => (
              <Link
                key={p.id}
                to="/post/$id"
                params={{ id: p.id }}
                className="flex items-center gap-3 p-3 hover:bg-accent/50"
              >
                <span className="w-8 shrink-0 text-center text-lg font-black text-muted-foreground">{medal(i)}</span>
                <UserAvatar path={p.avatar_url} name={p.display_name ?? p.username ?? "?"} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.caption || "Untitled reel"}</div>
                  <div className="truncate text-xs text-muted-foreground">@{p.username}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
                  <active.icon className="h-3.5 w-3.5" /> {p.metric_value}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-primary" /> Top creators by subscribers
          </h2>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {creators.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">No creators yet.</p>
            )}
            {creators.map((c, i) => (
              <Link
                key={c.id}
                to="/profile/$username"
                params={{ username: c.username }}
                className="flex items-center gap-3 p-3 hover:bg-accent/50"
              >
                <span className="w-8 shrink-0 text-center text-lg font-black text-muted-foreground">{medal(i)}</span>
                <UserAvatar path={c.avatar_url} name={c.display_name ?? c.username} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.display_name ?? c.username}</div>
                  <div className="truncate text-xs text-muted-foreground">@{c.username}</div>
                </div>
                <div className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">
                  {c.subscriber_count} subs
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
