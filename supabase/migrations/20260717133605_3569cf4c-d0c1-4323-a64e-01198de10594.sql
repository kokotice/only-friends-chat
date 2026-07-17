
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_post_view(uuid) FROM PUBLIC;

-- storage policies: signed-URL flow. Only owners can upload/delete; reads via signed URLs from server.
CREATE POLICY "own avatar upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own avatar update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own avatar delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars read all" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'avatars');

CREATE POLICY "own post upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own post delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "posts read all" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'posts');
