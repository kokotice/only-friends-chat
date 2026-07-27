
-- 1. Storage: drop public read policies for private buckets (app uses signed URLs)
DROP POLICY IF EXISTS "avatars read all" ON storage.objects;
DROP POLICY IF EXISTS "posts read all" ON storage.objects;

-- 2. live_streams: restrict SELECT to host + mutual friends
DROP POLICY IF EXISTS "live read" ON public.live_streams;
CREATE POLICY "live read friends or self" ON public.live_streams
  FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR public.are_friends(auth.uid(), host_id));

-- 3. subscriptions: restrict SELECT to rows involving caller
DROP POLICY IF EXISTS "subs readable" ON public.subscriptions;
CREATE POLICY "subs readable to involved" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id OR auth.uid() = subscribed_to_id);

-- 4. SECURITY DEFINER functions: lock down execute
-- Revoke from PUBLIC/anon on all definer functions; revoke from authenticated on internal helpers.
REVOKE ALL ON FUNCTION public._sparks_adjust(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._reward_on_like() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_daily() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boost_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.change_username(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tip_user(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gamble_coinflip(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gamble_slots(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid) FROM PUBLIC, anon;

-- Ensure authenticated retains access to user-callable RPCs (each enforces auth.uid())
GRANT EXECUTE ON FUNCTION public.claim_daily() TO authenticated;
GRANT EXECUTE ON FUNCTION public.boost_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tip_user(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gamble_coinflip(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gamble_slots(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated;
