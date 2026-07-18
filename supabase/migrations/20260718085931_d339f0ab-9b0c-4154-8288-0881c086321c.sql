
-- 1) Extend profiles with wallet fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sparks integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_daily_at timestamptz,
  ADD COLUMN IF NOT EXISTS boost_until timestamptz;

-- 2) Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  kind text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx read own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3) Gambling bets
CREATE TABLE IF NOT EXISTS public.gambling_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game text NOT NULL,
  wager integer NOT NULL,
  payout integer NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gambling_bets TO authenticated;
GRANT ALL ON public.gambling_bets TO service_role;
ALTER TABLE public.gambling_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets read own" ON public.gambling_bets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4) Helper: adjust balance (internal, not exposed)
CREATE OR REPLACE FUNCTION public._sparks_adjust(_uid uuid, _delta integer, _kind text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_bal integer;
BEGIN
  UPDATE profiles SET sparks = sparks + _delta WHERE id = _uid RETURNING sparks INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF new_bal < 0 THEN RAISE EXCEPTION 'insufficient sparks'; END IF;
  INSERT INTO transactions(user_id, amount, kind, meta) VALUES (_uid, _delta, _kind, _meta);
  RETURN new_bal;
END $$;
REVOKE ALL ON FUNCTION public._sparks_adjust(uuid, integer, text, jsonb) FROM PUBLIC;

-- 5) Claim daily +50 (once per 20h)
CREATE OR REPLACE FUNCTION public.claim_daily()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _last timestamptz; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT last_daily_at INTO _last FROM profiles WHERE id = _uid;
  IF _last IS NOT NULL AND _last > now() - interval '20 hours' THEN
    RAISE EXCEPTION 'daily already claimed';
  END IF;
  UPDATE profiles SET last_daily_at = now() WHERE id = _uid;
  _bal := public._sparks_adjust(_uid, 50, 'daily', '{}'::jsonb);
  RETURN _bal;
END $$;
REVOKE ALL ON FUNCTION public.claim_daily() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily() TO authenticated;

-- 6) Coinflip
CREATE OR REPLACE FUNCTION public.gamble_coinflip(_wager integer, _pick text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _roll text; _win boolean; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 OR _wager > 1000 THEN RAISE EXCEPTION 'wager 1-1000'; END IF;
  IF _pick NOT IN ('heads','tails') THEN RAISE EXCEPTION 'bad pick'; END IF;
  PERFORM public._sparks_adjust(_uid, -_wager, 'coinflip_bet', jsonb_build_object('pick',_pick));
  _roll := (ARRAY['heads','tails'])[1 + floor(random()*2)::int];
  _win := _roll = _pick;
  _payout := CASE WHEN _win THEN _wager*2 ELSE 0 END;
  IF _payout > 0 THEN _bal := public._sparks_adjust(_uid, _payout, 'coinflip_win', jsonb_build_object('roll',_roll)); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'coinflip',_wager,_payout,jsonb_build_object('roll',_roll,'pick',_pick,'win',_win));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('win',_win,'roll',_roll,'payout',_payout,'balance',_bal);
END $$;
REVOKE ALL ON FUNCTION public.gamble_coinflip(integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gamble_coinflip(integer,text) TO authenticated;

-- 7) Slots (3 reels of 5 symbols)
CREATE OR REPLACE FUNCTION public.gamble_slots(_wager integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _reels text[]; _syms text[] := ARRAY['🍒','🍋','🔔','⭐','💎'];
  _a text; _b text; _c text; _mult integer := 0; _payout integer; _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _wager < 1 OR _wager > 2000 THEN RAISE EXCEPTION 'wager 1-2000'; END IF;
  PERFORM public._sparks_adjust(_uid, -_wager, 'slots_bet', '{}'::jsonb);
  _a := _syms[1+floor(random()*5)::int];
  _b := _syms[1+floor(random()*5)::int];
  _c := _syms[1+floor(random()*5)::int];
  IF _a=_b AND _b=_c THEN
    _mult := CASE _a WHEN '💎' THEN 20 WHEN '⭐' THEN 10 WHEN '🔔' THEN 6 WHEN '🍋' THEN 4 ELSE 3 END;
  ELSIF _a=_b OR _b=_c OR _a=_c THEN
    _mult := 1; -- return wager (push)
  END IF;
  _payout := _wager * _mult;
  IF _payout > 0 THEN PERFORM public._sparks_adjust(_uid, _payout, 'slots_win', jsonb_build_object('reels',ARRAY[_a,_b,_c])); END IF;
  INSERT INTO gambling_bets(user_id,game,wager,payout,result) VALUES (_uid,'slots',_wager,_payout,jsonb_build_object('reels',ARRAY[_a,_b,_c]));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN jsonb_build_object('reels',ARRAY[_a,_b,_c],'payout',_payout,'balance',_bal);
END $$;
REVOKE ALL ON FUNCTION public.gamble_slots(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gamble_slots(integer) TO authenticated;

-- 8) Tip another user
CREATE OR REPLACE FUNCTION public.tip_user(_to uuid, _amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bal integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid = _to THEN RAISE EXCEPTION 'cannot tip self'; END IF;
  IF _amount < 1 OR _amount > 10000 THEN RAISE EXCEPTION 'amount 1-10000'; END IF;
  PERFORM public._sparks_adjust(_uid, -_amount, 'tip_sent', jsonb_build_object('to',_to));
  PERFORM public._sparks_adjust(_to, _amount, 'tip_received', jsonb_build_object('from',_uid));
  SELECT sparks INTO _bal FROM profiles WHERE id=_uid;
  RETURN _bal;
END $$;
REVOKE ALL ON FUNCTION public.tip_user(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tip_user(uuid,integer) TO authenticated;

-- 9) Change username (200 sparks)
CREATE OR REPLACE FUNCTION public.change_username(_new text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _clean text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  _clean := regexp_replace(lower(_new), '[^a-z0-9_]', '', 'g');
  IF length(_clean) < 3 OR length(_clean) > 20 THEN RAISE EXCEPTION 'username 3-20 chars, a-z0-9_'; END IF;
  IF EXISTS(SELECT 1 FROM profiles WHERE username = _clean AND id <> _uid) THEN RAISE EXCEPTION 'username taken'; END IF;
  PERFORM public._sparks_adjust(_uid, -200, 'username_change', jsonb_build_object('new',_clean));
  UPDATE profiles SET username = _clean WHERE id = _uid;
  RETURN _clean;
END $$;
REVOKE ALL ON FUNCTION public.change_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;

-- 10) Boost profile for 24h (100 sparks)
CREATE OR REPLACE FUNCTION public.boost_profile()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _until timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public._sparks_adjust(_uid, -100, 'boost', '{}'::jsonb);
  _until := now() + interval '24 hours';
  UPDATE profiles SET boost_until = _until WHERE id = _uid;
  RETURN _until;
END $$;
REVOKE ALL ON FUNCTION public.boost_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boost_profile() TO authenticated;

-- 11) Update view function to also reward author (+1 spark per view, capped by ledger)
CREATE OR REPLACE FUNCTION public.increment_post_view(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = p_id RETURNING author_id INTO _author;
  IF _author IS NOT NULL THEN
    PERFORM public._sparks_adjust(_author, 1, 'view_reward', jsonb_build_object('post',p_id));
  END IF;
END $$;

-- 12) Reward on like: trigger gives author +5 sparks when liked
CREATE OR REPLACE FUNCTION public._reward_on_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _author uuid;
BEGIN
  SELECT author_id INTO _author FROM posts WHERE id = NEW.post_id;
  IF _author IS NOT NULL AND _author <> NEW.user_id THEN
    PERFORM public._sparks_adjust(_author, 5, 'like_reward', jsonb_build_object('post',NEW.post_id,'from',NEW.user_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reward_on_like ON public.likes;
CREATE TRIGGER reward_on_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public._reward_on_like();
