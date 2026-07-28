
-- 1. Storage read policies (needed for createSignedUrl)
CREATE POLICY "authenticated read posts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'posts');
CREATE POLICY "authenticated read avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

-- 2. Change display name for 200 sparks
CREATE OR REPLACE FUNCTION public.change_display_name(_new text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _clean text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  _clean := btrim(_new);
  IF length(_clean) < 1 OR length(_clean) > 40 THEN RAISE EXCEPTION 'display name 1-40 chars'; END IF;
  PERFORM public._sparks_adjust(_uid, -200, 'display_name_change', jsonb_build_object('new', _clean));
  UPDATE profiles SET display_name = _clean WHERE id = _uid;
  RETURN _clean;
END $$;

REVOKE EXECUTE ON FUNCTION public.change_display_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_display_name(text) TO authenticated;

-- 3. Dice game (pick 'over' or 'under' 50, 1.95x payout)
CREATE OR REPLACE FUNCTION public.gamble_dice(_wager integer, _pick text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _roll integer; _win boolean; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 OR _wager > 1000 THEN RAISE EXCEPTION 'wager 1-1000'; END IF;
  IF _pick NOT IN ('over','under') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._sparks_adjust(_uid, -_wager, 'dice_bet', jsonb_build_object('pick', _pick));
  _roll := 1 + floor(random() * 100)::int; -- 1..100
  _win := (_pick = 'over' AND _roll > 50) OR (_pick = 'under' AND _roll < 50);
  _payout := CASE WHEN _win THEN (_wager * 195) / 100 ELSE 0 END;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'dice_win', jsonb_build_object('roll', _roll)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'dice', _wager, _payout, jsonb_build_object('roll', _roll, 'pick', _pick, 'win', _win));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('win', _win, 'roll', _roll, 'payout', _payout, 'balance', _bal);
END $$;

REVOKE EXECUTE ON FUNCTION public.gamble_dice(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamble_dice(integer, text) TO authenticated;

-- 4. Wheel of Sparks (weighted multipliers)
CREATE OR REPLACE FUNCTION public.gamble_wheel(_wager integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r numeric; _mult integer; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 OR _wager > 1500 THEN RAISE EXCEPTION 'wager 1-1500'; END IF;
  PERFORM public._sparks_adjust(_uid, -_wager, 'wheel_bet', '{}'::jsonb);
  _r := random();
  -- weights: 0x 50%, 2x 30%, 3x 12%, 5x 6%, 10x 2%
  _mult := CASE
    WHEN _r < 0.50 THEN 0
    WHEN _r < 0.80 THEN 2
    WHEN _r < 0.92 THEN 3
    WHEN _r < 0.98 THEN 5
    ELSE 10
  END;
  _payout := _wager * _mult;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'wheel_win', jsonb_build_object('mult', _mult)); END IF;
  INSERT INTO gambling_bets(user_id, game, wager, payout, result)
    VALUES (_uid, 'wheel', _wager, _payout, jsonb_build_object('mult', _mult));
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN jsonb_build_object('mult', _mult, 'payout', _payout, 'balance', _bal);
END $$;

REVOKE EXECUTE ON FUNCTION public.gamble_wheel(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamble_wheel(integer) TO authenticated;
