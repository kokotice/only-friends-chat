ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS steps_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casino_unlocked boolean NOT NULL DEFAULT false;

-- Pay-per-watch: 50 sparks the first time you watch a post, free forever after.
CREATE OR REPLACE FUNCTION public.watch_post(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _author uuid; _bal integer; _charged boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT author_id INTO _author FROM posts WHERE id = p_id;
  IF _author IS NULL THEN RAISE EXCEPTION 'post not found'; END IF;

  IF _author = _uid OR EXISTS(SELECT 1 FROM post_views WHERE post_id = p_id AND user_id = _uid) THEN
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
END $$;

-- Which of these posts has the caller already unlocked (watched)?
CREATE OR REPLACE FUNCTION public.my_watched_posts(_ids uuid[])
RETURNS TABLE(post_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id FROM posts p
  WHERE p.id = ANY(_ids)
    AND (p.author_id = auth.uid()
         OR EXISTS(SELECT 1 FROM post_views v WHERE v.post_id = p.id AND v.user_id = auth.uid()));
$$;

-- Walking rewards.
CREATE OR REPLACE FUNCTION public.record_steps(_n integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _i integer; _r numeric; _gain integer := 0; _bal integer; _steps integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _n IS NULL OR _n < 1 THEN RAISE EXCEPTION 'invalid step count'; END IF;
  _n := LEAST(_n, 25);
  FOR _i IN 1.._n LOOP
    _r := random();
    _gain := _gain + CASE
      WHEN _r < 0.50   THEN 1  + floor(random()*3)::int      -- 1-3
      WHEN _r < 0.80   THEN 3  + floor(random()*3)::int      -- 3-5
      WHEN _r < 0.95   THEN 6  + floor(random()*5)::int      -- 6-10
      WHEN _r < 0.99   THEN 10 + floor(random()*11)::int     -- 10-20
      WHEN _r < 0.999  THEN 20 + floor(random()*181)::int    -- 20-200
      ELSE                  200 + floor(random()*801)::int   -- 200-1000
    END;
  END LOOP;
  UPDATE profiles SET steps_total = steps_total + _n WHERE id = _uid RETURNING steps_total INTO _steps;
  _bal := public._sparks_adjust(_uid, _gain, 'walk_reward', jsonb_build_object('steps', _n));
  RETURN jsonb_build_object('gained', _gain, 'balance', _bal, 'steps', _steps);
END $$;

-- Casino access: buy it, or walk 10 000 steps.
CREATE OR REPLACE FUNCTION public.unlock_casino(_platform text DEFAULT 'mobile')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _steps integer; _open boolean; _cost integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT steps_total, casino_unlocked, sparks INTO _steps, _open, _bal FROM profiles WHERE id = _uid;
  IF _open THEN RETURN jsonb_build_object('unlocked', true, 'cost', 0, 'balance', _bal); END IF;

  IF _steps >= 10000 THEN
    UPDATE profiles SET casino_unlocked = true WHERE id = _uid;
    RETURN jsonb_build_object('unlocked', true, 'cost', 0, 'balance', _bal, 'via', 'steps');
  END IF;

  _cost := CASE WHEN _platform = 'pc' THEN 30000 ELSE 150000 END;
  _bal := public._sparks_adjust(_uid, -_cost, 'casino_unlock', jsonb_build_object('platform', _platform));
  UPDATE profiles SET casino_unlocked = true WHERE id = _uid;
  RETURN jsonb_build_object('unlocked', true, 'cost', _cost, 'balance', _bal, 'via', 'purchase');
END $$;

REVOKE ALL ON FUNCTION public.watch_post(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.my_watched_posts(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.record_steps(integer) FROM anon;
REVOKE ALL ON FUNCTION public.unlock_casino(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.watch_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_watched_posts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_steps(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_casino(text) TO authenticated;