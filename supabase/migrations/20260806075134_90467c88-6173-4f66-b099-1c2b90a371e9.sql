-- 1. Profiles: column-level privileges so sensitive fields are owner-only
REVOKE SELECT, UPDATE, INSERT ON public.profiles FROM authenticated;
REVOKE ALL ON public.profiles FROM anon;

GRANT SELECT (id, username, display_name, avatar_url, bio, created_at, boost_until, active_theme)
  ON public.profiles TO authenticated;
GRANT UPDATE (avatar_url, bio) ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Owner reads full row through this definer function.
CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;

-- 2. create_post: enforce the paid upload limit and bill the real object size
CREATE OR REPLACE FUNCTION public.create_post(_video_url text, _caption text, _bytes bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _cost integer; _pid uuid; _real bigint; _limit integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT (o.metadata->>'size')::bigint INTO _real
  FROM storage.objects o
  WHERE o.bucket_id = 'posts' AND o.name = _video_url
    AND (storage.foldername(o.name))[1] = _uid::text;

  IF _real IS NULL THEN RAISE EXCEPTION 'upload not found for this account'; END IF;
  IF _real <= 0 THEN RAISE EXCEPTION 'invalid file size'; END IF;

  SELECT max_upload_mb INTO _limit FROM profiles WHERE id = _uid;
  IF _real > COALESCE(_limit, 60)::bigint * 1048576 THEN
    RAISE EXCEPTION 'file is larger than your % MB upload limit', COALESCE(_limit, 60);
  END IF;

  _cost := public.upload_cost(_real);
  PERFORM public._sparks_adjust(_uid, -_cost, 'upload_fee', jsonb_build_object('bytes', _real, 'cost', _cost));
  INSERT INTO posts(author_id, video_url, caption)
  VALUES (_uid, _video_url, NULLIF(btrim(coalesce(_caption,'')), ''))
  RETURNING id INTO _pid;
  RETURN _pid;
END $function$;

-- 3. Storage reads: require ownership or an actual profile/post reference
DROP POLICY IF EXISTS "authenticated read avatars" ON storage.objects;
DROP POLICY IF EXISTS "authenticated read posts" ON storage.objects;

CREATE POLICY "avatars read owner or referenced"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.avatar_url = storage.objects.name)
  )
);

CREATE POLICY "posts read owner or published"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'posts'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.posts po WHERE po.video_url = storage.objects.name)
  )
);

-- 4. Storage writes: block oversized objects at insert time as a second gate
DROP POLICY IF EXISTS "posts insert within upload limit" ON storage.objects;
CREATE POLICY "posts insert within upload limit"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((metadata->>'size')::bigint, 0)
      <= COALESCE((SELECT max_upload_mb FROM public.profiles WHERE id = auth.uid()), 60)::bigint * 1048576
);

-- 5. Internal SECURITY DEFINER helpers are not part of the public API
REVOKE EXECUTE ON FUNCTION public._sparks_adjust(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bet_gate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._luck(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._vip_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.theme_perks(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._grant_default_theme() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._reward_on_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Player-facing RPCs: signed-in only, never anonymous
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('boost_profile','buy_spark_generator','buy_upload_boost','buy_vip','change_display_name',
                        'change_username','claim_daily','claim_generator','create_group','create_post','equip_theme',
                        'feed_ranked','gamble_coinflip','gamble_dice','gamble_slots','gamble_wheel','group_add_member',
                        'group_buy_seat','increment_post_view','is_group_member','is_group_owner','open_crate',
                        'record_share','tip_user','top_creators','top_posts','are_friends','my_profile')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;