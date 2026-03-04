-- Ensure profile avatar persistence and storage security model for avatars.

-- 1) Guarantee avatar_url exists on profiles.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Create/normalize avatars bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3) Rebuild storage policies including avatars.
DROP POLICY IF EXISTS storage_public_read_images ON storage.objects;
DROP POLICY IF EXISTS storage_insert_scoped_by_bucket_role ON storage.objects;
DROP POLICY IF EXISTS storage_update_scoped_by_bucket_role ON storage.objects;
DROP POLICY IF EXISTS storage_delete_scoped_by_bucket_role ON storage.objects;

CREATE POLICY storage_public_read_images
ON storage.objects
FOR SELECT
USING (bucket_id IN ('avatars', 'profiles', 'events', 'event-images', 'branding'));

CREATE POLICY storage_insert_scoped_by_bucket_role
ON storage.objects
FOR INSERT
WITH CHECK (
  (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  OR (
    bucket_id = 'profiles'
    AND auth.uid() IS NOT NULL
  )
  OR (
    bucket_id IN ('events', 'event-images', 'branding')
    AND (public.is_organizer_user(auth.uid()) OR public.is_admin_user(auth.uid()))
  )
  OR (
    bucket_id = 'avatars'
    AND public.is_admin_user(auth.uid())
  )
);

CREATE POLICY storage_update_scoped_by_bucket_role
ON storage.objects
FOR UPDATE
USING (
  (
    bucket_id = 'avatars'
    AND (
      (
        auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      OR public.is_admin_user(auth.uid())
    )
  )
  OR (
    bucket_id = 'profiles'
    AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
  )
  OR (
    bucket_id IN ('events', 'event-images', 'branding')
    AND (
      (owner = auth.uid() AND public.is_organizer_user(auth.uid()))
      OR public.is_admin_user(auth.uid())
    )
  )
)
WITH CHECK (
  (
    bucket_id = 'avatars'
    AND (
      (
        auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      OR public.is_admin_user(auth.uid())
    )
  )
  OR (
    bucket_id = 'profiles'
    AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
  )
  OR (
    bucket_id IN ('events', 'event-images', 'branding')
    AND (
      (owner = auth.uid() AND public.is_organizer_user(auth.uid()))
      OR public.is_admin_user(auth.uid())
    )
  )
);

CREATE POLICY storage_delete_scoped_by_bucket_role
ON storage.objects
FOR DELETE
USING (
  (
    bucket_id = 'avatars'
    AND (
      (
        auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      OR public.is_admin_user(auth.uid())
    )
  )
  OR (
    bucket_id = 'profiles'
    AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
  )
  OR (
    bucket_id IN ('events', 'event-images', 'branding')
    AND (
      (owner = auth.uid() AND public.is_organizer_user(auth.uid()))
      OR public.is_admin_user(auth.uid())
    )
  )
);
