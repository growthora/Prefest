-- Storage access model aligned to app roles:
-- - Buyers and organizers can manage their own uploads.
-- - Admins can manage all uploads.
-- - Public read for image buckets used by the frontend.

-- NOTE:
-- We intentionally do not ALTER TABLE storage.objects here because ownership can differ by environment.

-- Cleanup potentially conflicting policy names used in this project
DROP POLICY IF EXISTS "Public Access Branding" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload Branding" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update Branding" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete Branding" ON storage.objects;

DROP POLICY IF EXISTS storage_public_read_images ON storage.objects;
DROP POLICY IF EXISTS storage_insert_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS storage_update_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS storage_delete_own_or_admin ON storage.objects;

-- Public read for image buckets
CREATE POLICY storage_public_read_images
ON storage.objects
FOR SELECT
USING (bucket_id IN ('profiles', 'events', 'event-images', 'branding'));

-- Any authenticated user can upload to app image buckets; admins too.
-- Ownership restrictions are enforced on update/delete by owner/admin checks.
CREATE POLICY storage_insert_own_or_admin
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id IN ('profiles', 'events', 'event-images', 'branding')
  AND (
    auth.uid() IS NOT NULL
    OR public.is_admin_user(auth.uid())
  )
);

CREATE POLICY storage_update_own_or_admin
ON storage.objects
FOR UPDATE
USING (
  bucket_id IN ('profiles', 'events', 'event-images', 'branding')
  AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
)
WITH CHECK (
  bucket_id IN ('profiles', 'events', 'event-images', 'branding')
  AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
);

CREATE POLICY storage_delete_own_or_admin
ON storage.objects
FOR DELETE
USING (
  bucket_id IN ('profiles', 'events', 'event-images', 'branding')
  AND (owner = auth.uid() OR public.is_admin_user(auth.uid()))
);
