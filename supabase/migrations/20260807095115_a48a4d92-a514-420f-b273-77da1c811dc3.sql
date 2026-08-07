CREATE OR REPLACE FUNCTION public.my_upload_limit_mb()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT max_upload_mb FROM public.profiles WHERE id = auth.uid()), 60);
$$;

REVOKE ALL ON FUNCTION public.my_upload_limit_mb() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_upload_limit_mb() TO authenticated;

DROP POLICY IF EXISTS "posts insert within upload limit" ON storage.objects;
CREATE POLICY "posts insert within upload limit"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND COALESCE((metadata->>'size')::bigint, 0) <= public.my_upload_limit_mb()::bigint * 1048576
);

DROP POLICY IF EXISTS "own post upload" ON storage.objects;
