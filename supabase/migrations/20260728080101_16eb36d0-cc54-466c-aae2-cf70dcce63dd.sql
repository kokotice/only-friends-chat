
-- 1) likes: restrict SELECT to authenticated
DROP POLICY IF EXISTS "likes read" ON public.likes;
CREATE POLICY "likes read authenticated" ON public.likes
  FOR SELECT TO authenticated USING (true);

-- 2) profiles: restrict SELECT to authenticated
DROP POLICY IF EXISTS "profiles readable by all" ON public.profiles;
CREATE POLICY "profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- 3) are_friends: only reveal friendship when caller is one of the parties
CREATE OR REPLACE FUNCTION public.are_friends(u1 uuid, u2 uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN auth.uid() <> u1 AND auth.uid() <> u2 THEN false
      ELSE EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u1 AND subscribed_to_id = u2)
       AND EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u2 AND subscribed_to_id = u1)
    END;
$$;

-- 4) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Internal helpers: no direct execute for app roles
REVOKE EXECUTE ON FUNCTION public._sparks_adjust(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._reward_on_like() FROM PUBLIC, anon, authenticated;
