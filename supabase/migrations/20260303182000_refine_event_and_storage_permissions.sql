-- Refine permissions:
-- - Organizers/Admins can create/edit/delete events and ticket types.
-- - Buyers can manage own profile uploads.
-- - Public can read published events and their ticket types.
-- - Event image uploads restricted to organizer/admin.

-- 1) Role helper
CREATE OR REPLACE FUNCTION public.is_organizer_user(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        (p.roles IS NOT NULL AND ('ORGANIZER' = ANY(p.roles) OR 'organizer' = ANY(p.roles)))
        OR lower(coalesce(p.role, '')) = 'organizer'
      )
      AND upper(coalesce(p.organizer_status, 'NONE')) = 'APPROVED'
  );
$$;

-- 2) Events policies
DROP POLICY IF EXISTS rls_events_manage_owner_or_admin ON public.events;
DROP POLICY IF EXISTS rls_events_select_published_owner_admin ON public.events;
DROP POLICY IF EXISTS rls_events_insert_organizer_or_admin ON public.events;
DROP POLICY IF EXISTS rls_events_update_owner_organizer_or_admin ON public.events;
DROP POLICY IF EXISTS rls_events_delete_owner_organizer_or_admin ON public.events;

CREATE POLICY rls_events_select_published_owner_admin
ON public.events
FOR SELECT
USING (
  status = 'published'
  OR creator_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

CREATE POLICY rls_events_insert_organizer_or_admin
ON public.events
FOR INSERT
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND creator_id = auth.uid()
  )
);

CREATE POLICY rls_events_update_owner_organizer_or_admin
ON public.events
FOR UPDATE
USING (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND creator_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND creator_id = auth.uid()
  )
);

CREATE POLICY rls_events_delete_owner_organizer_or_admin
ON public.events
FOR DELETE
USING (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND creator_id = auth.uid()
  )
);

-- 3) Ticket types policies
DROP POLICY IF EXISTS rls_ticket_types_manage_event_owner_or_admin ON public.ticket_types;
DROP POLICY IF EXISTS rls_ticket_types_select_public_or_owner_admin ON public.ticket_types;
DROP POLICY IF EXISTS rls_ticket_types_insert_owner_admin ON public.ticket_types;
DROP POLICY IF EXISTS rls_ticket_types_update_owner_admin ON public.ticket_types;
DROP POLICY IF EXISTS rls_ticket_types_delete_owner_admin ON public.ticket_types;

CREATE POLICY rls_ticket_types_select_public_or_owner_admin
ON public.ticket_types
FOR SELECT
USING (
  public.can_manage_event(event_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = ticket_types.event_id
      AND e.status = 'published'
  )
);

CREATE POLICY rls_ticket_types_insert_owner_admin
ON public.ticket_types
FOR INSERT
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND public.can_manage_event(event_id, auth.uid())
  )
);

CREATE POLICY rls_ticket_types_update_owner_admin
ON public.ticket_types
FOR UPDATE
USING (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND public.can_manage_event(event_id, auth.uid())
  )
)
WITH CHECK (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND public.can_manage_event(event_id, auth.uid())
  )
);

CREATE POLICY rls_ticket_types_delete_owner_admin
ON public.ticket_types
FOR DELETE
USING (
  public.is_admin_user(auth.uid())
  OR (
    public.is_organizer_user(auth.uid())
    AND public.can_manage_event(event_id, auth.uid())
  )
);

-- 4) Storage objects policies
DROP POLICY IF EXISTS storage_insert_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS storage_update_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS storage_delete_own_or_admin ON storage.objects;

DROP POLICY IF EXISTS storage_insert_scoped_by_bucket_role ON storage.objects;
DROP POLICY IF EXISTS storage_update_scoped_by_bucket_role ON storage.objects;
DROP POLICY IF EXISTS storage_delete_scoped_by_bucket_role ON storage.objects;

CREATE POLICY storage_insert_scoped_by_bucket_role
ON storage.objects
FOR INSERT
WITH CHECK (
  (
    bucket_id = 'profiles'
    AND auth.uid() IS NOT NULL
  )
  OR (
    bucket_id IN ('events', 'event-images', 'branding')
    AND (public.is_organizer_user(auth.uid()) OR public.is_admin_user(auth.uid()))
  )
);

CREATE POLICY storage_update_scoped_by_bucket_role
ON storage.objects
FOR UPDATE
USING (
  (
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
