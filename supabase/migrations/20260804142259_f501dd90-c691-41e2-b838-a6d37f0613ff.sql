-- 1) Share tracking -----------------------------------------------------
CREATE TABLE public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post shares read authenticated" ON public.post_shares FOR SELECT TO authenticated USING (true);
CREATE POLICY "post shares insert own" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX post_shares_post_idx ON public.post_shares(post_id);

-- 2) Gambling: cooldown instead of caps ---------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_bet_at timestamptz;

CREATE OR REPLACE FUNCTION public._bet_gate()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT last_bet_at INTO _last FROM profiles WHERE id = _uid;
  IF _last IS NOT NULL AND _last > now() - interval '10 seconds' THEN
    RAISE EXCEPTION 'cooldown: wait % more seconds', ceil(10 - extract(epoch FROM (now() - _last)));
  END IF;
  UPDATE profiles SET last_bet_at = now() WHERE id = _uid;
END $$;

CREATE OR REPLACE FUNCTION public.gamble_coinflip(_wager integer, _pick text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _roll text; _win boolean; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  IF _pick NOT IN ('heads','tails') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._bet_gate();
  PERFORM public._sparks_adjust(_uid, -_wager, 'coinflip_bet', jsonb_build_object('pick',_pick));
  _roll := (ARRAY['heads','tails'])[1 + floor(random()*2)::int];
  _win := _roll = _pick;
  _payout := CASE WHEN _win THEN _wager*2 ELSE 0 END;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'coinflip_win', jsonb_build_object('roll',_roll)); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'coinflip',_wager,_payout,jsonb_build_object('roll',_roll,'pick',_pick,'win',_win));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('win',_win,'roll',_roll,'payout',_payout,'balance',_bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_dice(_wager integer, _pick text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _roll integer; _win boolean; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  IF _pick NOT IN ('over','under') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._bet_gate();
  PERFORM public._sparks_adjust(_uid, -_wager, 'dice_bet', jsonb_build_object('pick', _pick));
  _roll := 1 + floor(random() * 100)::int;
  _win := (_pick = 'over' AND _roll > 50) OR (_pick = 'under' AND _roll < 50);
  _payout := CASE WHEN _win THEN (_wager * 195) / 100 ELSE 0 END;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'dice_win', jsonb_build_object('roll', _roll)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'dice', _wager, _payout, jsonb_build_object('roll', _roll, 'pick', _pick, 'win', _win));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('win', _win, 'roll', _roll, 'payout', _payout, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_wheel(_wager integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _r numeric; _mult integer; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  PERFORM public._bet_gate();
  PERFORM public._sparks_adjust(_uid, -_wager, 'wheel_bet', '{}'::jsonb);
  _r := random();
  _mult := CASE WHEN _r < 0.50 THEN 0 WHEN _r < 0.80 THEN 2 WHEN _r < 0.92 THEN 3 WHEN _r < 0.98 THEN 5 ELSE 10 END;
  _payout := _wager * _mult;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'wheel_win', jsonb_build_object('mult', _mult)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'wheel', _wager, _payout, jsonb_build_object('mult', _mult));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('mult', _mult, 'payout', _payout, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_slots(_wager integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _syms text[] := ARRAY['🍒','🍋','🔔','⭐','💎'];
  _a text; _b text; _c text; _mult integer := 0; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  PERFORM public._bet_gate();
  PERFORM public._sparks_adjust(_uid, -_wager, 'slots_bet', '{}'::jsonb);
  _a := _syms[1+floor(random()*5)::int];
  _b := _syms[1+floor(random()*5)::int];
  _c := _syms[1+floor(random()*5)::int];
  IF _a=_b AND _b=_c THEN
    _mult := CASE _a WHEN '💎' THEN 20 WHEN '⭐' THEN 10 WHEN '🔔' THEN 6 WHEN '🍋' THEN 4 ELSE 3 END;
  ELSIF _a=_b OR _b=_c OR _a=_c THEN _mult := 1;
  END IF;
  _payout := _wager * _mult;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'slots_win', jsonb_build_object('reels',ARRAY[_a,_b,_c])); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'slots',_wager,_payout,jsonb_build_object('reels',ARRAY[_a,_b,_c]));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('reels',ARRAY[_a,_b,_c],'payout',_payout,'balance',_bal);
END $$;

-- 3) Paid uploads: 3 sparks per whole megabyte ---------------------------
CREATE OR REPLACE FUNCTION public.upload_cost(_bytes bigint)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT GREATEST(1, floor(_bytes / 1048576.0)::int) * 3;
$$;

CREATE OR REPLACE FUNCTION public.create_post(_video_url text, _caption text, _bytes bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _cost integer; _pid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _bytes IS NULL OR _bytes <= 0 THEN RAISE EXCEPTION 'invalid file size'; END IF;
  _cost := public.upload_cost(_bytes);
  PERFORM public._sparks_adjust(_uid, -_cost, 'upload_fee', jsonb_build_object('bytes', _bytes, 'cost', _cost));
  INSERT INTO posts(author_id, video_url, caption) VALUES (_uid, _video_url, NULLIF(btrim(coalesce(_caption,'')), ''))
  RETURNING id INTO _pid;
  RETURN _pid;
END $$;

-- 4) Share recording -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_share(_post_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _n integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO post_shares(post_id, user_id) VALUES (_post_id, _uid);
  SELECT count(*) INTO _n FROM post_shares WHERE post_id = _post_id;
  RETURN _n;
END $$;

-- 5) The feed algorithm --------------------------------------------------
CREATE OR REPLACE FUNCTION public.feed_ranked(_limit integer DEFAULT 8, _offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, author_id uuid, video_url text, caption text, view_count integer, created_at timestamptz,
  username text, display_name text, avatar_url text,
  like_count integer, comment_count integer, share_count integer,
  liked_by_me boolean, subscribed boolean, score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  base AS (
    SELECT p.id, p.author_id, p.video_url, p.caption, p.view_count, p.created_at,
           pr.username, pr.display_name, pr.avatar_url,
           (SELECT count(*) FROM likes l WHERE l.post_id = p.id)::int AS like_count,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count,
           (SELECT count(*) FROM post_shares s WHERE s.post_id = p.id)::int AS share_count,
           EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = (SELECT uid FROM me)) AS liked_by_me,
           EXISTS(SELECT 1 FROM subscriptions su WHERE su.subscriber_id = (SELECT uid FROM me) AND su.subscribed_to_id = p.author_id) AS subscribed,
           EXISTS(SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = (SELECT uid FROM me)) AS seen
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.author_id
  )
  SELECT b.id, b.author_id, b.video_url, b.caption, b.view_count, b.created_at,
         b.username, b.display_name, b.avatar_url,
         b.like_count, b.comment_count, b.share_count, b.liked_by_me, b.subscribed,
         (
           (ln(1 + b.view_count) * 1.0
            + b.like_count * 3.0
            + b.share_count * 6.0
            + b.comment_count * 2.0
            + 1.0)
           * (CASE WHEN b.subscribed THEN 2.5 ELSE 1.0 END)
           * (CASE WHEN b.seen THEN 0.35 ELSE 1.0 END)
           * (1.0 + 6.0 / (6.0 + EXTRACT(epoch FROM (now() - b.created_at)) / 3600.0))
           * (0.7 + 0.8 * (abs(hashtext(b.id::text || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24') || coalesce((SELECT uid FROM me)::text,''))) % 1000) / 1000.0)
         )::numeric AS score
  FROM base b
  ORDER BY score DESC, b.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 30)) OFFSET GREATEST(0, _offset);
$$;

-- 6) Leaderboards --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.top_posts(_metric text)
RETURNS TABLE (
  id uuid, author_id uuid, video_url text, caption text, created_at timestamptz,
  username text, display_name text, avatar_url text,
  view_count integer, like_count integer, share_count integer, metric_value integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT p.id, p.author_id, p.video_url, p.caption, p.created_at,
           pr.username, pr.display_name, pr.avatar_url, p.view_count,
           (SELECT count(*) FROM likes l WHERE l.post_id = p.id)::int AS like_count,
           (SELECT count(*) FROM post_shares s WHERE s.post_id = p.id)::int AS share_count
    FROM posts p LEFT JOIN profiles pr ON pr.id = p.author_id
  )
  SELECT b.*, CASE _metric WHEN 'likes' THEN b.like_count WHEN 'shares' THEN b.share_count ELSE b.view_count END AS metric_value
  FROM base b
  ORDER BY CASE _metric WHEN 'likes' THEN b.like_count WHEN 'shares' THEN b.share_count ELSE b.view_count END DESC,
           b.created_at DESC
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.top_creators()
RETURNS TABLE (id uuid, username text, display_name text, avatar_url text, subscriber_count integer, subscribed_by_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.id, pr.username, pr.display_name, pr.avatar_url,
         (SELECT count(*) FROM subscriptions s WHERE s.subscribed_to_id = pr.id)::int AS subscriber_count,
         EXISTS(SELECT 1 FROM subscriptions s2 WHERE s2.subscribed_to_id = pr.id AND s2.subscriber_id = auth.uid()) AS subscribed_by_me
  FROM profiles pr
  ORDER BY subscriber_count DESC, pr.created_at ASC
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION public._bet_gate() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.feed_ranked(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.top_posts(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.top_creators() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_post(text, text, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_ranked(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_posts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_creators() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_cost(bigint) TO authenticated;