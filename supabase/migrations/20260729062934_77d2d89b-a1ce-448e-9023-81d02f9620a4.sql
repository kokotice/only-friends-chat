ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gen_until timestamptz,
  ADD COLUMN IF NOT EXISTS gen_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_upload_mb integer NOT NULL DEFAULT 60;

CREATE OR REPLACE FUNCTION public.buy_spark_generator()
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _until timestamptz; _cur timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT gen_until INTO _cur FROM profiles WHERE id = _uid;
  PERFORM public.claim_generator();
  PERFORM public._sparks_adjust(_uid, -1000, 'shop_generator', '{}'::jsonb);
  IF _cur IS NOT NULL AND _cur > now() THEN
    _until := _cur + interval '30 minutes';
  ELSE
    _until := now() + interval '30 minutes';
    UPDATE profiles SET gen_claimed_at = now() WHERE id = _uid;
  END IF;
  UPDATE profiles SET gen_until = _until WHERE id = _uid;
  RETURN _until;
END $$;

CREATE OR REPLACE FUNCTION public.claim_generator()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _until timestamptz; _last timestamptz; _secs numeric; _amt integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT gen_until, gen_claimed_at INTO _until, _last FROM profiles WHERE id = _uid;
  IF _until IS NULL OR _last IS NULL THEN RETURN 0; END IF;
  _secs := EXTRACT(epoch FROM (LEAST(now(), _until) - _last));
  IF _secs <= 0 THEN RETURN 0; END IF;
  _amt := floor(_secs * 1.2)::int;
  IF _amt <= 0 THEN RETURN 0; END IF;
  UPDATE profiles SET gen_claimed_at = LEAST(now(), _until) WHERE id = _uid;
  PERFORM public._sparks_adjust(_uid, _amt, 'generator_income', jsonb_build_object('seconds', round(_secs)));
  RETURN _amt;
END $$;

CREATE OR REPLACE FUNCTION public.buy_upload_boost()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _cur integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT max_upload_mb INTO _cur FROM profiles WHERE id = _uid;
  IF _cur >= 800 THEN RAISE EXCEPTION 'already unlocked'; END IF;
  PERFORM public._sparks_adjust(_uid, -5000, 'shop_upload_boost', '{}'::jsonb);
  UPDATE profiles SET max_upload_mb = 800 WHERE id = _uid;
  RETURN 800;
END $$;

REVOKE EXECUTE ON FUNCTION public.buy_spark_generator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_generator() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.buy_upload_boost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_spark_generator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_upload_boost() TO authenticated;