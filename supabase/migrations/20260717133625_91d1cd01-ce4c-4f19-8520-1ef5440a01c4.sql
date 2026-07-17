
CREATE OR REPLACE FUNCTION public.are_friends(u1 uuid, u2 uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u1 AND subscribed_to_id = u2)
     AND EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u2 AND subscribed_to_id = u1);
$$;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;

-- Make increment_post_view invoker; posts are publicly readable, so anon can UPDATE view_count via this? No.
-- Keep as SECURITY DEFINER but scoped tightly.
CREATE OR REPLACE FUNCTION public.increment_post_view(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated, anon;
