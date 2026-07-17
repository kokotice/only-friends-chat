
ALTER TABLE public.posts ADD CONSTRAINT posts_author_profile_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.live_streams ADD CONSTRAINT live_streams_host_profile_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
