-- Team members module for organizer operational scanner accounts

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_members_organizer_user_unique UNIQUE (organizer_id, user_id),
  CONSTRAINT team_members_self_link_check CHECK (organizer_id <> user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_organizer_id ON public.team_members(organizer_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

CREATE OR REPLACE FUNCTION public.team_members_enforce_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.team_members tm
  WHERE tm.organizer_id = NEW.organizer_id
    AND (TG_OP = 'INSERT' OR tm.id <> NEW.id);

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'TEAM_MEMBERS_LIMIT_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_members_enforce_limit ON public.team_members;
CREATE TRIGGER trg_team_members_enforce_limit
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.team_members_enforce_limit();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_team_members_select_self_org_admin ON public.team_members;
CREATE POLICY rls_team_members_select_self_org_admin
ON public.team_members
FOR SELECT
USING (
  organizer_id = auth.uid()
  OR user_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS rls_team_members_insert_org_admin ON public.team_members;
CREATE POLICY rls_team_members_insert_org_admin
ON public.team_members
FOR INSERT
WITH CHECK (
  organizer_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS rls_team_members_delete_org_admin ON public.team_members;
CREATE POLICY rls_team_members_delete_org_admin
ON public.team_members
FOR DELETE
USING (
  organizer_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS rls_team_members_update_org_admin ON public.team_members;
CREATE POLICY rls_team_members_update_org_admin
ON public.team_members
FOR UPDATE
USING (
  organizer_id = auth.uid()
  OR public.is_admin_user(auth.uid())
)
WITH CHECK (
  organizer_id = auth.uid()
  OR public.is_admin_user(auth.uid())
);

-- Scanner access helper: team member can access organizer events via team_members link
DROP POLICY IF EXISTS rls_events_select_team_members ON public.events;
CREATE POLICY rls_events_select_team_members
ON public.events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.organizer_id = events.creator_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS rls_check_in_logs_select_team_members ON public.check_in_logs;
CREATE POLICY rls_check_in_logs_select_team_members
ON public.check_in_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.team_members tm ON tm.organizer_id = e.creator_id
    WHERE e.id = check_in_logs.event_id
      AND tm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = check_in_logs.event_id
      AND e.creator_id = auth.uid()
  )
  OR public.is_admin_user(auth.uid())
);

