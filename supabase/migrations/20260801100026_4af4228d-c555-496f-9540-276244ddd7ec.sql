CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_limit integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.group_members ADD CONSTRAINT group_members_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.group_messages ADD CONSTRAINT group_messages_sender_profile_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX group_messages_group_created_idx ON public.group_messages(group_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.groups WHERE id = _group_id AND owner_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups read members" ON public.groups FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_member(id, auth.uid()));
CREATE POLICY "groups insert own" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups update owner" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "groups delete owner" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group members read" ON public.group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));
CREATE POLICY "group members insert owner or self-join-as-owner" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (public.is_group_owner(group_id, auth.uid()));
CREATE POLICY "group members delete owner or self" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_owner(group_id, auth.uid()));

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "group messages read members" ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "group messages insert members" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "group messages delete own" ON public.group_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_group(_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _clean text; _gid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  _clean := btrim(_name);
  IF length(_clean) < 1 OR length(_clean) > 40 THEN RAISE EXCEPTION 'group name 1-40 chars'; END IF;
  INSERT INTO groups(name, owner_id) VALUES (_clean, _uid) RETURNING id INTO _gid;
  INSERT INTO group_members(group_id, user_id) VALUES (_gid, _uid);
  RETURN _gid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.group_add_member(_group_id uuid, _user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _limit integer; _count integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT seat_limit INTO _limit FROM groups WHERE id = _group_id AND owner_id = _uid;
  IF _limit IS NULL THEN RAISE EXCEPTION 'only the owner can add members'; END IF;
  IF NOT (EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = _uid AND subscribed_to_id = _user_id)
      AND EXISTS(SELECT 1 FROM subscriptions WHERE subscriber_id = _user_id AND subscribed_to_id = _uid)) THEN
    RAISE EXCEPTION 'you can only add mutual friends';
  END IF;
  SELECT count(*) INTO _count FROM group_members WHERE group_id = _group_id;
  IF _count >= _limit THEN RAISE EXCEPTION 'group is full (% seats)', _limit; END IF;
  INSERT INTO group_members(group_id, user_id) VALUES (_group_id, _user_id) ON CONFLICT DO NOTHING;
  SELECT count(*) INTO _count FROM group_members WHERE group_id = _group_id;
  RETURN _count;
END $$;
REVOKE EXECUTE ON FUNCTION public.group_add_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_add_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.group_buy_seat(_group_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _limit integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT seat_limit INTO _limit FROM groups WHERE id = _group_id AND owner_id = _uid;
  IF _limit IS NULL THEN RAISE EXCEPTION 'only the owner can buy seats'; END IF;
  PERFORM public._sparks_adjust(_uid, -10000, 'group_seat', jsonb_build_object('group', _group_id));
  UPDATE groups SET seat_limit = seat_limit + 1 WHERE id = _group_id RETURNING seat_limit INTO _limit;
  RETURN _limit;
END $$;
REVOKE EXECUTE ON FUNCTION public.group_buy_seat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_buy_seat(uuid) TO authenticated;