-- Align RLS to access model:
-- - Organizer: full control over own events and related data.
-- - Buyer: full control over own data.
-- - Admin: full control over all users/data.

-- 1) Helper functions
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid DEFAULT auth.uid())
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
        (p.roles IS NOT NULL AND ('ADMIN' = ANY(p.roles) OR 'admin' = ANY(p.roles)))
        OR lower(coalesce(p.role, '')) = 'admin'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (e.creator_id = p_user_id OR public.is_admin_user(p_user_id))
  );
$$;

-- 2) Ensure RLS is enabled on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_asaas_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 3) Profiles
DROP POLICY IF EXISTS rls_profiles_select_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_insert_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_update_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_delete_self_or_admin ON public.profiles;

CREATE POLICY rls_profiles_select_self_or_admin
ON public.profiles
FOR SELECT
USING (id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY rls_profiles_insert_self_or_admin
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY rls_profiles_update_self_or_admin
ON public.profiles
FOR UPDATE
USING (id = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY rls_profiles_delete_self_or_admin
ON public.profiles
FOR DELETE
USING (id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 4) Events
DROP POLICY IF EXISTS rls_events_manage_owner_or_admin ON public.events;

CREATE POLICY rls_events_manage_owner_or_admin
ON public.events
FOR ALL
USING (creator_id = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (creator_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 5) Ticket types (managed by event owner/admin)
DROP POLICY IF EXISTS rls_ticket_types_manage_event_owner_or_admin ON public.ticket_types;

CREATE POLICY rls_ticket_types_manage_event_owner_or_admin
ON public.ticket_types
FOR ALL
USING (public.can_manage_event(event_id, auth.uid()))
WITH CHECK (public.can_manage_event(event_id, auth.uid()));

-- 6) Tickets
DROP POLICY IF EXISTS rls_tickets_manage_buyer_owner_admin ON public.tickets;

CREATE POLICY rls_tickets_manage_buyer_owner_admin
ON public.tickets
FOR ALL
USING (
  buyer_user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
  OR public.can_manage_event(event_id, auth.uid())
)
WITH CHECK (
  buyer_user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
  OR public.can_manage_event(event_id, auth.uid())
);

-- 7) Event participants
DROP POLICY IF EXISTS rls_event_participants_manage_user_owner_admin ON public.event_participants;

CREATE POLICY rls_event_participants_manage_user_owner_admin
ON public.event_participants
FOR ALL
USING (
  user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
  OR public.can_manage_event(event_id, auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
  OR public.can_manage_event(event_id, auth.uid())
);

-- 8) Organizer Asaas accounts
DROP POLICY IF EXISTS rls_org_asaas_manage_self_or_admin ON public.organizer_asaas_accounts;

CREATE POLICY rls_org_asaas_manage_self_or_admin
ON public.organizer_asaas_accounts
FOR ALL
USING (organizer_user_id = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (organizer_user_id = auth.uid() OR public.is_admin_user(auth.uid()));

-- 9) Payments
DROP POLICY IF EXISTS rls_payments_manage_related_or_admin ON public.payments;

CREATE POLICY rls_payments_manage_related_or_admin
ON public.payments
FOR ALL
USING (
  user_id = auth.uid()
  OR organizer_user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  OR organizer_user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

-- 10) Storage policies are intentionally excluded from this migration because
-- altering storage.objects ownership/policies requires a different owner context.
