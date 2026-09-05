import { createFileRoute } from "@tanstack/react-router";

/**
 * OnlyFriend — the house content bot.
 *
 * Every 30 minutes (pg_cron) this endpoint asks the official YouTube Data API
 * for a fresh, embeddable short video on a random topic and posts it to the
 * feed as the "OnlyFriend" account. Videos are embedded with YouTube's own
 * player (stored as `yt:<videoId>`), so the original creator keeps the views
 * and credit — nothing is downloaded or re-uploaded.
 *
 * The endpoint is self-rate-limited: it refuses to post more than once every
 * 25 minutes, so a stray public call can't spam the feed.
 */

const BOT_USERNAME = "OnlyFriend";
const BOT_EMAIL = "onlyfriend-bot@onlyfriends.app";
const MIN_GAP_MS = 25 * 60 * 1000;

const TOPICS = [
  "funny animals shorts",
  "satisfying shorts",
  "street food shorts",
  "gaming clips shorts",
  "skateboard tricks shorts",
  "dance shorts",
  "science experiment shorts",
  "cooking hacks shorts",
  "parkour shorts",
  "cute cats shorts",
  "basketball highlights shorts",
  "diy crafts shorts",
  "guitar solo shorts",
  "nature timelapse shorts",
  "magic tricks shorts",
];

type YtItem = {
  id?: { videoId?: string };
  snippet?: { title?: string; channelTitle?: string };
};

export const Route = createFileRoute("/api/public/onlyfriend-bot")({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env["YOUTUBE_API_KEY"];
        if (!apiKey) return Response.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Make sure the OnlyFriend account exists.
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("username", BOT_USERNAME)
          .maybeSingle();

        let botId = existing?.id ?? null;
        if (!botId) {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: BOT_EMAIL,
            password: crypto.randomUUID() + crypto.randomUUID(),
            email_confirm: true,
            user_metadata: { username: BOT_USERNAME, display_name: "OnlyFriend" },
          });
          if (createErr || !created.user) {
            return Response.json({ error: createErr?.message ?? "bot user failed" }, { status: 500 });
          }
          botId = created.user.id;
          await supabaseAdmin
            .from("profiles")
            .upsert(
              { id: botId, username: BOT_USERNAME, display_name: "OnlyFriend", bio: "Your house bot 🤖 — reposting the best shorts every 30 minutes." },
              { onConflict: "id" },
            );
        }

        // 2) Self rate-limit.
        const { data: last } = await supabaseAdmin
          .from("posts")
          .select("created_at")
          .eq("author_id", botId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (last?.created_at && Date.now() - new Date(last.created_at).getTime() < MIN_GAP_MS) {
          return Response.json({ skipped: "too soon" }, { status: 200 });
        }

        // 3) Ask YouTube for embeddable shorts on a random topic.
        const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]!;
        const params = new URLSearchParams({
          key: apiKey,
          part: "snippet",
          q: topic,
          type: "video",
          videoDuration: "short",
          videoEmbeddable: "true",
          videoSyndicated: "true",
          safeSearch: "strict",
          order: "viewCount",
          maxResults: "25",
          publishedAfter: new Date(Date.now() - 30 * 86400_000).toISOString(),
        });

        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        if (!res.ok) {
          return Response.json({ error: `youtube ${res.status}`, detail: await res.text() }, { status: 502 });
        }
        const body = (await res.json()) as { items?: YtItem[] };
        const items = (body.items ?? []).filter((i) => i.id?.videoId);
        if (items.length === 0) return Response.json({ skipped: "no results", topic }, { status: 200 });

        // 4) Skip anything already posted.
        const urls = items.map((i) => `yt:${i.id!.videoId}`);
        const { data: dupes } = await supabaseAdmin.from("posts").select("video_url").in("video_url", urls);
        const seen = new Set((dupes ?? []).map((d) => d.video_url));
        const pool = items.filter((i) => !seen.has(`yt:${i.id!.videoId}`));
        if (pool.length === 0) return Response.json({ skipped: "all duplicates", topic }, { status: 200 });

        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        const title = (pick.snippet?.title ?? "Untitled").slice(0, 180);
        const channel = pick.snippet?.channelTitle ?? "YouTube";

        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("posts")
          .insert({
            author_id: botId,
            video_url: `yt:${pick.id!.videoId}`,
            caption: `${title} · via ${channel} on YouTube`,
          })
          .select("id")
          .single();

        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
        return Response.json({ posted: inserted.id, topic, video: pick.id!.videoId });
      },
      GET: async () => Response.json({ bot: BOT_USERNAME, ok: true }),
    },
  },
});
