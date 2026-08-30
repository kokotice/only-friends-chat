-- roles
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- reports
CREATE TYPE public.report_reason AS ENUM ('racist','sexual_abuse','underage','other');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  reason public.report_reason NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_user_id)
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports insert own" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports read own" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
CREATE POLICY "staff read reports" ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- discord gift + staff applications
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_joined_at timestamptz;

INSERT INTO public.themes (key,name,rarity,bg_l,bg_c,bg_h,ac_l,ac_c,ac_h,luck_bonus,spark_bonus,feed_bonus,blurb)
VALUES ('discord_blurple','Discord Blurple','epic',0.16,0.03,275,0.62,0.19,272,0.02,0.10,0.10,'Members-only gift for joining the OnlyFriends Discord.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_discord_gift()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE profiles SET discord_joined_at = COALESCE(discord_joined_at, now()) WHERE id = _uid;
  IF NOT EXISTS (SELECT 1 FROM user_themes WHERE user_id = _uid AND theme_key = 'discord_blurple') THEN
    INSERT INTO user_themes(user_id, theme_key) VALUES (_uid,'discord_blurple');
    _new := true;
  END IF;
  RETURN jsonb_build_object('new', _new, 'theme', 'discord_blurple');
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_discord_gift() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_discord_gift() TO authenticated;

CREATE TABLE public.staff_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  discord_tag text NOT NULL,
  why text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.staff_applications TO authenticated;
GRANT ALL ON public.staff_applications TO service_role;
ALTER TABLE public.staff_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps insert own" ON public.staff_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.discord_joined_at IS NOT NULL));
CREATE POLICY "apps read own" ON public.staff_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admins read apps" ON public.staff_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_staff_applications_updated_at BEFORE UPDATE ON public.staff_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- paid avatar change (50 sparks, split between the founders)
CREATE OR REPLACE FUNCTION public.set_avatar(_path text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _bal integer; _a uuid; _b uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _path IS NULL OR btrim(_path) = '' THEN RAISE EXCEPTION 'missing avatar path'; END IF;
  IF (storage.foldername(_path))[1] <> _uid::text THEN RAISE EXCEPTION 'invalid avatar path'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'avatars' AND o.name = _path) THEN
    RAISE EXCEPTION 'upload not found';
  END IF;

  PERFORM public._sparks_adjust(_uid, -50, 'avatar_change', jsonb_build_object('path', _path));

  SELECT id INTO _a FROM profiles WHERE username = 'slovakgmd';
  SELECT id INTO _b FROM profiles WHERE username = 'galaxylord';
  IF _a IS NOT NULL AND _a <> _uid THEN PERFORM public._sparks_adjust(_a, 25, 'avatar_fee_share', jsonb_build_object('from', _uid)); END IF;
  IF _b IS NOT NULL AND _b <> _uid THEN PERFORM public._sparks_adjust(_b, 25, 'avatar_fee_share', jsonb_build_object('from', _uid)); END IF;

  UPDATE profiles SET avatar_url = _path WHERE id = _uid;
  SELECT sparks INTO _bal FROM profiles WHERE id = _uid;
  RETURN _bal;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_avatar(text) TO authenticated;

-- founders as admins
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles WHERE username IN ('slovakgmd','galaxylord')
ON CONFLICT DO NOTHING;