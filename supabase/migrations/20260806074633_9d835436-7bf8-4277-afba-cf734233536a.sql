ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_until timestamptz,
  ADD COLUMN IF NOT EXISTS vip_tier text;

CREATE OR REPLACE FUNCTION public._vip_bonus(_uid uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p.vip_until IS NULL OR p.vip_until <= now() THEN 0
    WHEN p.vip_tier = 'elite' THEN 3.0
    WHEN p.vip_tier = 'vip' THEN 0.10
    ELSE 0
  END
  FROM public.profiles p WHERE p.id = _uid;
$$;

CREATE OR REPLACE FUNCTION public._sparks_adjust(_uid uuid, _delta integer, _kind text, _meta jsonb DEFAULT '{}'::jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE new_bal integer; _b numeric; _v numeric;
BEGIN
  IF _delta > 0 AND _kind IN ('daily','view_reward','like_reward','generator_income') THEN
    SELECT COALESCE(spark,0) INTO _b FROM public.theme_perks(_uid);
    _v := COALESCE(public._vip_bonus(_uid), 0);
    _delta := GREATEST(_delta, ceil(_delta * (1 + COALESCE(_b,0) + _v))::int);
  END IF;
  UPDATE profiles SET sparks = sparks + _delta WHERE id = _uid RETURNING sparks INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF new_bal < 0 THEN RAISE EXCEPTION 'insufficient sparks'; END IF;
  INSERT INTO transactions(user_id, amount, kind, meta) VALUES (_uid, _delta, _kind, _meta);
  RETURN new_bal;
END $function$;

CREATE OR REPLACE FUNCTION public.buy_vip(_tier text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _cost integer; _days integer;
        _cur_until timestamptz; _cur_tier text; _until timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _tier = 'vip' THEN _cost := 100000; _days := 3;
  ELSIF _tier = 'elite' THEN _cost := 3000000; _days := 30;
  ELSE RAISE EXCEPTION 'unknown tier';
  END IF;

  SELECT vip_until, vip_tier INTO _cur_until, _cur_tier FROM profiles WHERE id = _uid;
  PERFORM public._sparks_adjust(_uid, -_cost, 'shop_vip', jsonb_build_object('tier', _tier, 'days', _days));

  IF _cur_until IS NOT NULL AND _cur_until > now() AND _cur_tier = _tier THEN
    _until := _cur_until + make_interval(days => _days);
  ELSE
    _until := now() + make_interval(days => _days);
  END IF;

  UPDATE profiles SET vip_until = _until, vip_tier = _tier WHERE id = _uid;
  RETURN _until;
END $$;

REVOKE EXECUTE ON FUNCTION public.buy_vip(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_vip(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._vip_bonus(uuid) FROM PUBLIC, anon;