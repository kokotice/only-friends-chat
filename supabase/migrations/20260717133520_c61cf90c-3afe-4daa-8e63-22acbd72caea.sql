
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscribed_to_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, subscribed_to_id),
  CHECK (subscriber_id <> subscribed_to_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs readable" ON public.subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "own sub insert" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "own sub delete" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid() = subscriber_id);

-- mutual subs helper
CREATE OR REPLACE FUNCTION public.are_friends(u1 uuid, u2 uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u1 AND subscribed_to_id = u2)
     AND EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = u2 AND subscribed_to_id = u1);
$$;

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages read own" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "messages send if friends" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.are_friends(sender_id, recipient_id));
CREATE POLICY "messages delete own" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);
CREATE INDEX messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);

-- posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  caption text,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts public read" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts insert own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts update own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "posts delete own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX posts_author_idx ON public.posts (author_id, created_at DESC);

-- likes
CREATE TABLE public.likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes read" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes insert own" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- live streams
CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  started_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live read" ON public.live_streams FOR SELECT TO authenticated USING (true);
CREATE POLICY "live insert own" ON public.live_streams FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "live update own" ON public.live_streams FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "live delete own" ON public.live_streams FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- increment views RPC
CREATE OR REPLACE FUNCTION public.increment_post_view(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid) TO authenticated, anon;

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'user'
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF length(base_username) < 3 THEN base_username := 'user' || substr(NEW.id::text, 1, 6); END IF;
  final_username := base_username;
  WHILE EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || counter::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime for messages and live streams
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
