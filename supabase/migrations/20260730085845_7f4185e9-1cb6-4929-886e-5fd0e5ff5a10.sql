CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment likes read authenticated" ON public.comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment likes insert own" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment likes delete own" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_views (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post views read authenticated" ON public.post_views FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.increment_post_view(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _author uuid; _uid uuid := auth.uid(); _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.post_views(post_id, user_id) VALUES (p_id, _uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF NOT _inserted THEN RETURN; END IF;
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = p_id RETURNING author_id INTO _author;
  IF _author IS NOT NULL AND _author <> _uid THEN
    PERFORM public._sparks_adjust(_author, 1, 'view_reward', jsonb_build_object('post', p_id));
  END IF;
END $function$;

REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated;