
-- =============== THEMES ===============
CREATE TABLE public.themes (
  key text PRIMARY KEY,
  name text NOT NULL,
  rarity text NOT NULL,
  bg_l numeric NOT NULL, bg_c numeric NOT NULL, bg_h numeric NOT NULL,
  ac_l numeric NOT NULL, ac_c numeric NOT NULL, ac_h numeric NOT NULL,
  luck_bonus numeric NOT NULL DEFAULT 0,
  spark_bonus numeric NOT NULL DEFAULT 0,
  feed_bonus numeric NOT NULL DEFAULT 0,
  blurb text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.themes TO authenticated;
GRANT ALL ON public.themes TO service_role;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "themes readable" ON public.themes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.crates (
  key text PRIMARY KEY,
  name text NOT NULL,
  cost integer NOT NULL,
  odds jsonb NOT NULL,
  blurb text,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.crates TO authenticated;
GRANT ALL ON public.crates TO service_role;
ALTER TABLE public.crates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crates readable" ON public.crates FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_themes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_key text NOT NULL REFERENCES public.themes(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, theme_key)
);
GRANT SELECT ON public.user_themes TO authenticated;
GRANT ALL ON public.user_themes TO service_role;
ALTER TABLE public.user_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own themes read" ON public.user_themes FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_theme text NOT NULL DEFAULT 'neon_pink';

INSERT INTO public.themes (key,name,rarity,bg_l,bg_c,bg_h,ac_l,ac_c,ac_h,luck_bonus,spark_bonus,feed_bonus,blurb) VALUES
('neon_pink','Neon Pink','common',0.14,0.005,300,0.72,0.24,358,0,0,0,'The OnlyFriends original.'),
('slate','Slate','common',0.14,0.004,255,0.70,0.10,250,0,0,0,'Quiet and clean.'),
('mint','Mint','common',0.14,0.005,160,0.78,0.14,165,0,0,0,'Fresh air.'),
('amber','Amber','common',0.14,0.006,60,0.78,0.16,75,0,0,0,'Warm glow.'),
('teal','Teal','common',0.14,0.005,200,0.74,0.13,195,0,0,0,'Deep water.'),
('crimson','Crimson','common',0.14,0.006,20,0.66,0.19,25,0,0,0,'Simple and sharp.'),
('steel','Steel','common',0.15,0.003,240,0.75,0.06,240,0,0,0,'Industrial grey.'),
('rose_dust','Rose Dust','common',0.14,0.006,350,0.75,0.11,350,0,0,0,'Soft pink haze.'),
('ocean','Ocean','uncommon',0.13,0.008,250,0.70,0.18,245,0.01,0.02,0,'+2% Sparks, +1% luck.'),
('lime','Lime','uncommon',0.14,0.008,130,0.82,0.20,135,0,0.03,0,'+3% Sparks.'),
('coral','Coral','uncommon',0.14,0.009,30,0.74,0.19,35,0.02,0,0,'+2% luck.'),
('violet','Violet','uncommon',0.13,0.010,300,0.68,0.20,300,0,0.02,0.03,'+2% Sparks, +3% reach.'),
('ember','Ember','uncommon',0.13,0.010,40,0.70,0.21,45,0.02,0.01,0,'+2% luck.'),
('ice','Ice','uncommon',0.15,0.006,220,0.86,0.12,215,0.01,0.02,0,'Cold hands, warm wallet.'),
('jade','Jade','uncommon',0.13,0.008,155,0.72,0.17,160,0,0.03,0.02,'+3% Sparks.'),
('bronze','Bronze','uncommon',0.14,0.008,70,0.66,0.13,65,0.01,0.02,0.01,'Old money starter.'),
('cyber_blue','Cyber Blue','rare',0.12,0.010,255,0.76,0.22,250,0.03,0.04,0.03,'+4% Sparks, +3% luck.'),
('toxic','Toxic','rare',0.12,0.012,140,0.86,0.24,140,0.04,0.03,0.02,'+4% luck.'),
('sunset','Sunset','rare',0.13,0.012,25,0.75,0.22,20,0.02,0.05,0.04,'+5% Sparks, +4% reach.'),
('magma','Magma','rare',0.12,0.014,35,0.68,0.24,30,0.05,0.02,0.02,'+5% luck.'),
('arctic','Arctic','rare',0.14,0.008,230,0.90,0.14,220,0.03,0.05,0.02,'Frozen fortune.'),
('royal','Royal','rare',0.12,0.012,285,0.66,0.22,290,0.03,0.03,0.05,'+5% reach.'),
('blood_moon','Blood Moon','rare',0.11,0.014,15,0.60,0.24,20,0.05,0.04,0.02,'It watches.'),
('master','Master','epic',0.10,0.010,20,0.62,0.26,25,0.08,0.06,0.05,'Black & red. +8% luck, +6% Sparks, +5% reach.'),
('galaxy','Galaxy','epic',0.10,0.014,300,0.58,0.24,300,0.05,0.08,0.08,'Black & deep purple. +8% Sparks, +8% reach.'),
('void','Void','epic',0.08,0.004,270,0.70,0.20,275,0.07,0.07,0.06,'Absolute darkness.'),
('aurora','Aurora','epic',0.11,0.012,190,0.82,0.22,175,0.06,0.08,0.07,'Northern lights.'),
('phantom','Phantom','epic',0.10,0.008,210,0.80,0.10,205,0.07,0.06,0.08,'Barely there.'),
('golden_god','Golden God','legendary',0.11,0.014,85,0.86,0.20,90,0.12,0.14,0.12,'+12% luck, +14% Sparks, +12% reach.'),
('dragon_scale','Dragon Scale','legendary',0.10,0.016,145,0.80,0.26,150,0.13,0.12,0.12,'Ultra rare drop.'),
('hyperbeam','Hyperbeam','legendary',0.10,0.018,320,0.78,0.30,325,0.12,0.13,0.14,'Loud and proud.'),
('singularity','Singularity','mythic',0.07,0.010,280,0.70,0.32,295,0.20,0.35,0.35,'VERY OP: +20% luck, +35% Sparks, +35% reach.'),
('spark_god','Spark God','mythic',0.08,0.016,350,0.82,0.30,10,0.22,0.50,0.40,'VERY OP: +22% luck, +50% Sparks, +40% reach.');

INSERT INTO public.crates (key,name,cost,odds,blurb,sort) VALUES
('starter','Starter Crate',500,'{"common":70,"uncommon":25,"rare":5}','Cheap and cheerful.',1),
('neon','Neon Crate',2500,'{"common":33,"uncommon":36,"rare":23,"epic":7,"legendary":1}','Real chance at epics.',2),
('prime','Prime Crate',10000,'{"uncommon":30,"rare":35,"epic":25,"legendary":8,"mythic":2}','Where the good stuff starts.',3),
('cosmic','Cosmic Crate',40000,'{"rare":25,"epic":40,"legendary":25,"mythic":10}','10% mythic. Good luck.',4);

INSERT INTO public.user_themes (user_id, theme_key) SELECT id, 'neon_pink' FROM public.profiles ON CONFLICT DO NOTHING;

-- default theme for new users
CREATE OR REPLACE FUNCTION public._grant_default_theme() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.user_themes(user_id, theme_key) VALUES (NEW.id, 'neon_pink') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS grant_default_theme ON public.profiles;
CREATE TRIGGER grant_default_theme AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public._grant_default_theme();

-- =============== PERK HELPERS ===============
CREATE OR REPLACE FUNCTION public.theme_perks(_uid uuid)
RETURNS TABLE(luck numeric, spark numeric, feed numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(t.luck_bonus,0), COALESCE(t.spark_bonus,0), COALESCE(t.feed_bonus,0)
  FROM public.profiles p LEFT JOIN public.themes t ON t.key = p.active_theme
  WHERE p.id = _uid;
$$;

CREATE OR REPLACE FUNCTION public._luck(_uid uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT LEAST(0.25, COALESCE((SELECT luck FROM public.theme_perks(_uid)), 0));
$$;

-- Spark rewards scale with theme perk
CREATE OR REPLACE FUNCTION public._sparks_adjust(_uid uuid, _delta integer, _kind text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_bal integer; _b numeric;
BEGIN
  IF _delta > 0 AND _kind IN ('daily','view_reward','like_reward','generator_income') THEN
    SELECT COALESCE(spark,0) INTO _b FROM public.theme_perks(_uid);
    _delta := GREATEST(_delta, ceil(_delta * (1 + COALESCE(_b,0)))::int);
  END IF;
  UPDATE profiles SET sparks = sparks + _delta WHERE id = _uid RETURNING sparks INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF new_bal < 0 THEN RAISE EXCEPTION 'insufficient sparks'; END IF;
  INSERT INTO transactions(user_id, amount, kind, meta) VALUES (_uid, _delta, _kind, _meta);
  RETURN new_bal;
END $$;

-- =============== CRATES ===============
CREATE OR REPLACE FUNCTION public.open_crate(_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _cost integer; _odds jsonb; _total numeric := 0; _r numeric;
        _acc numeric := 0; _rar text; _pick text; _theme public.themes%ROWTYPE; _dupe boolean := false;
        _refund integer := 0; _bal integer; k text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT cost, odds INTO _cost, _odds FROM crates WHERE key = _key;
  IF _cost IS NULL THEN RAISE EXCEPTION 'unknown crate'; END IF;
  PERFORM public._sparks_adjust(_uid, -_cost, 'crate_open', jsonb_build_object('crate', _key));

  FOR k IN SELECT jsonb_object_keys(_odds) LOOP _total := _total + (_odds->>k)::numeric; END LOOP;
  _r := random() * _total;
  FOR k IN SELECT jsonb_object_keys(_odds) LOOP
    _acc := _acc + (_odds->>k)::numeric;
    IF _rar IS NULL AND _r <= _acc THEN _rar := k; END IF;
  END LOOP;
  IF _rar IS NULL THEN _rar := 'common'; END IF;

  SELECT key INTO _pick FROM themes WHERE rarity = _rar ORDER BY random() LIMIT 1;
  IF _pick IS NULL THEN SELECT key INTO _pick FROM themes ORDER BY random() LIMIT 1; END IF;
  SELECT * INTO _theme FROM themes WHERE key = _pick;

  IF EXISTS(SELECT 1 FROM user_themes WHERE user_id = _uid AND theme_key = _pick) THEN
    _dupe := true;
    _refund := CASE _rar WHEN 'common' THEN 100 WHEN 'uncommon' THEN 350 WHEN 'rare' THEN 1200
                         WHEN 'epic' THEN 4000 WHEN 'legendary' THEN 12000 ELSE 30000 END;
    PERFORM public._sparks_adjust(_uid, _refund, 'crate_dupe_refund', jsonb_build_object('theme', _pick));
  ELSE
    INSERT INTO user_themes(user_id, theme_key) VALUES (_uid, _pick);
  END IF;

  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('theme', to_jsonb(_theme), 'dupe', _dupe, 'refund', _refund, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.equip_theme(_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM user_themes WHERE user_id = _uid AND theme_key = _key) THEN
    RAISE EXCEPTION 'you do not own this theme';
  END IF;
  UPDATE profiles SET active_theme = _key WHERE id = _uid;
  RETURN _key;
END $$;

-- =============== GAMBLING REBALANCE ===============
CREATE OR REPLACE FUNCTION public.gamble_wheel(_wager integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _r numeric; _mult numeric; _payout integer; _bal integer; _lk numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  PERFORM public._bet_gate();
  _lk := public._luck(_uid);
  PERFORM public._sparks_adjust(_uid, -_wager, 'wheel_bet', '{}'::jsonb);
  _r := random();
  _mult := CASE WHEN _r < 0.60 THEN 0 WHEN _r < 0.85 THEN 1.5 WHEN _r < 0.95 THEN 2.5
                WHEN _r < 0.99 THEN 4 ELSE 9 END;
  IF _mult = 0 AND random() < _lk THEN _mult := 1.5; END IF;
  _payout := floor(_wager * _mult)::int;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'wheel_win', jsonb_build_object('mult', _mult)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'wheel', _wager, _payout, jsonb_build_object('mult', _mult));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('mult', _mult, 'payout', _payout, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_coinflip(_wager integer, _pick text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _roll text; _win boolean; _payout integer; _bal integer; _lk numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  IF _pick NOT IN ('heads','tails') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._bet_gate();
  _lk := public._luck(_uid);
  PERFORM public._sparks_adjust(_uid, -_wager, 'coinflip_bet', jsonb_build_object('pick',_pick));
  _roll := (ARRAY['heads','tails'])[1 + floor(random()*2)::int];
  _win := _roll = _pick;
  IF NOT _win AND random() < _lk THEN _win := true; _roll := _pick; END IF;
  _payout := CASE WHEN _win THEN (_wager * 192) / 100 ELSE 0 END;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'coinflip_win', jsonb_build_object('roll',_roll)); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'coinflip',_wager,_payout,jsonb_build_object('roll',_roll,'pick',_pick,'win',_win));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('win',_win,'roll',_roll,'payout',_payout,'balance',_bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_dice(_wager integer, _pick text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _roll integer; _win boolean; _payout integer; _bal integer; _lk numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  IF _pick NOT IN ('over','under') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._bet_gate();
  _lk := public._luck(_uid);
  PERFORM public._sparks_adjust(_uid, -_wager, 'dice_bet', jsonb_build_object('pick', _pick));
  _roll := 1 + floor(random() * 100)::int;
  _win := (_pick = 'over' AND _roll > 52) OR (_pick = 'under' AND _roll < 48);
  IF NOT _win AND random() < _lk THEN _win := true; END IF;
  _payout := CASE WHEN _win THEN (_wager * 190) / 100 ELSE 0 END;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'dice_win', jsonb_build_object('roll', _roll)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'dice', _wager, _payout, jsonb_build_object('roll', _roll, 'pick', _pick, 'win', _win));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('win', _win, 'roll', _roll, 'payout', _payout, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.gamble_slots(_wager integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _syms text[] := ARRAY['🍒','🍋','🔔','⭐','💎'];
  _a text; _b text; _c text; _mult integer := 0; _payout integer; _bal integer; _lk numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 THEN RAISE EXCEPTION 'wager must be at least 1'; END IF;
  PERFORM public._bet_gate();
  _lk := public._luck(_uid);
  PERFORM public._sparks_adjust(_uid, -_wager, 'slots_bet', '{}'::jsonb);
  _a := _syms[1+floor(random()*5)::int];
  _b := _syms[1+floor(random()*5)::int];
  _c := _syms[1+floor(random()*5)::int];
  IF _a=_b AND _b=_c THEN
    _mult := CASE _a WHEN '💎' THEN 18 WHEN '⭐' THEN 9 WHEN '🔔' THEN 5 WHEN '🍋' THEN 4 ELSE 3 END;
  ELSIF _a=_b OR _b=_c OR _a=_c THEN _mult := 1;
  END IF;
  IF _mult = 0 AND random() < _lk THEN _b := _a; _mult := 1; END IF;
  _payout := _wager * _mult;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'slots_win', jsonb_build_object('reels',ARRAY[_a,_b,_c])); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'slots',_wager,_payout,jsonb_build_object('reels',ARRAY[_a,_b,_c]));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('reels',ARRAY[_a,_b,_c],'payout',_payout,'balance',_bal);
END $$;

-- =============== FEED: tiered 50/30/20 mix ===============
DROP FUNCTION IF EXISTS public.feed_ranked(integer,integer);
CREATE OR REPLACE FUNCTION public.feed_ranked(_limit integer DEFAULT 8, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, author_id uuid, video_url text, caption text, view_count integer,
  created_at timestamptz, username text, display_name text, avatar_url text,
  like_count integer, comment_count integer, share_count integer,
  liked_by_me boolean, subscribed boolean, score numeric, tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  seed AS (SELECT to_char(date_trunc('hour', now()), 'YYYYMMDDHH24') || coalesce((SELECT uid FROM me)::text,'') AS s),
  base AS (
    SELECT p.id, p.author_id, p.video_url, p.caption, p.view_count, p.created_at,
           pr.username, pr.display_name, pr.avatar_url,
           COALESCE(tm.feed_bonus, 0) AS author_feed_bonus,
           (SELECT count(*) FROM likes l WHERE l.post_id = p.id)::int AS like_count,
           (SELECT count(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count,
           (SELECT count(*) FROM post_shares s WHERE s.post_id = p.id)::int AS share_count,
           EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = (SELECT uid FROM me)) AS liked_by_me,
           EXISTS(SELECT 1 FROM subscriptions su WHERE su.subscriber_id = (SELECT uid FROM me) AND su.subscribed_to_id = p.author_id) AS subscribed,
           EXISTS(SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = (SELECT uid FROM me)) AS seen,
           EXTRACT(epoch FROM (now() - p.created_at)) / 86400.0 AS age_days
    FROM posts p
    LEFT JOIN profiles pr ON pr.id = p.author_id
    LEFT JOIN themes tm ON tm.key = pr.active_theme
  ),
  scored AS (
    SELECT b.*,
      CASE WHEN b.age_days <= 3 THEN 'fresh3'
           WHEN b.age_days <= 7 THEN 'fresh7'
           ELSE 'popular' END AS tier0,
      (
        (ln(1 + b.view_count) * 1.0
         + b.like_count * 3.0
         + b.share_count * 6.0
         + b.comment_count * 2.0
         -- engagement quality: likes per view rewards good videos with few views
         + (CASE WHEN b.view_count > 0 THEN LEAST(1.0, (b.like_count + b.share_count)::numeric / b.view_count) * 8.0 ELSE 0 END)
         + 1.0)
        * (CASE WHEN b.subscribed THEN 2.5 ELSE 1.0 END)
        * (CASE WHEN b.seen THEN 0.3 ELSE 1.0 END)
        * (1.0 + b.author_feed_bonus)
        -- small-creator / new-post discovery lift
        * (CASE WHEN b.view_count < 5 THEN 1.35 ELSE 1.0 END)
        * (1.0 + 6.0 / (6.0 + b.age_days * 24.0))
        * (0.55 + 0.9 * (abs(hashtext(b.id::text || (SELECT s FROM seed))) % 1000) / 1000.0)
      )::numeric AS score
    FROM base b
  ),
  tiered AS (
    SELECT s.*,
      CASE WHEN s.tier0 = 'popular' THEN 'popular' ELSE s.tier0 END AS tier,
      row_number() OVER (
        PARTITION BY CASE WHEN s.tier0 = 'popular' THEN 'popular' ELSE s.tier0 END
        ORDER BY s.score DESC
      ) AS rn
    FROM scored s
  ),
  interleaved AS (
    SELECT t.*,
      (t.rn::numeric / CASE t.tier WHEN 'popular' THEN 0.5 WHEN 'fresh3' THEN 0.3 ELSE 0.2 END) AS slot
    FROM tiered t
  )
  SELECT i.id, i.author_id, i.video_url, i.caption, i.view_count, i.created_at,
         i.username, i.display_name, i.avatar_url,
         i.like_count, i.comment_count, i.share_count, i.liked_by_me, i.subscribed, i.score, i.tier
  FROM interleaved i
  ORDER BY i.slot ASC, i.score DESC
  LIMIT GREATEST(1, LEAST(_limit, 30)) OFFSET GREATEST(0, _offset);
$$;

REVOKE ALL ON FUNCTION public.feed_ranked(integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_ranked(integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.open_crate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_crate(text) TO authenticated;
REVOKE ALL ON FUNCTION public.equip_theme(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_theme(text) TO authenticated;
REVOKE ALL ON FUNCTION public.theme_perks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.theme_perks(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public._luck(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._sparks_adjust(uuid,integer,text,jsonb) FROM PUBLIC, anon;
