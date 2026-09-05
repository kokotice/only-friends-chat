-- lovable-cron-fallback-reviewed: 48 runs/day; user-requested 30-minute posting cadence for the OnlyFriend content bot, no event source exists to trigger it
-- OnlyFriend bot: reposted YouTube embeds are stored as video_url = 'yt:<videoId>'
-- and are always free to watch (no 50 Sparks fee) since they aren't member uploads.

CREATE OR REPLACE FUNCTION public.watch_post(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _author uuid; _url text; _bal integer; _charged boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT author_id, video_url INTO _author, _url FROM posts WHERE id = p_id;
  IF _author IS NULL THEN RAISE EXCEPTION 'post not found'; END IF;

  IF _author = _uid
     OR _url LIKE 'yt:%'
     OR EXISTS(SELECT 1 FROM post_views WHERE post_id = p_id AND user_id = _uid) THEN
    IF NOT EXISTS(SELECT 1 FROM post_views WHERE post_id = p_id AND user_id = _uid) THEN
      INSERT INTO post_views(post_id, user_id) VALUES (p_id, _uid) ON CONFLICT DO NOTHING;
      UPDATE posts SET view_count = view_count + 1 WHERE id = p_id;
    END IF;
    SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
    RETURN jsonb_build_object('charged', false, 'balance', _bal, 'unlocked', true);
  END IF;

  PERFORM public._sparks_adjust(_uid, -50, 'watch_fee', jsonb_build_object('post', p_id));
  _charged := true;
  INSERT INTO post_views(post_id, user_id) VALUES (p_id, _uid) ON CONFLICT DO NOTHING;
  UPDATE posts SET view_count = view_count + 1 WHERE id = p_id;
  PERFORM public._sparks_adjust(_author, 1, 'view_reward', jsonb_build_object('post', p_id));

  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('charged', _charged, 'balance', _bal, 'unlocked', true);
END $function$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onlyfriend-bot-repost') THEN
    PERFORM cron.unschedule('onlyfriend-bot-repost');
  END IF;
END $$;

SELECT cron.schedule(
  'onlyfriend-bot-repost',
  '*/30 * * * *',
  $$SELECT net.http_post(
      url := 'https://project--6388b5b6-fc80-4c98-9360-ab79fb74e48a.lovable.app/api/public/onlyfriend-bot',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );$$
);