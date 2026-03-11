-- Remove team access without deleting auth user.
-- Keeps the account as BUYER and removes only the EQUIPE role and organizer link.

CREATE OR REPLACE FUNCTION public.remove_team_member_access(
  p_organizer_id uuid,
  p_member_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_next_roles text[];
BEGIN
  IF p_organizer_id IS NULL OR p_member_user_id IS NULL THEN
    RAISE EXCEPTION 'organizer_id and member_user_id are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.organizer_id = p_organizer_id
      AND tm.user_id = p_member_user_id
  ) THEN
    RAISE EXCEPTION 'TEAM_MEMBER_NOT_FOUND';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_member_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT role_item
    FROM unnest(COALESCE(v_profile.roles, ARRAY['BUYER'])) AS role_item
    WHERE upper(role_item) <> 'EQUIPE'
  ) INTO v_next_roles;

  IF v_next_roles IS NULL OR array_length(v_next_roles, 1) IS NULL THEN
    v_next_roles := ARRAY['BUYER'];
  END IF;

  IF NOT ('BUYER' = ANY(v_next_roles)) THEN
    v_next_roles := array_prepend('BUYER', v_next_roles);
  END IF;

  UPDATE public.profiles
  SET roles = v_next_roles,
      organizer_status = 'NONE',
      role = 'user',
      account_type = 'comprador',
      updated_at = now()
  WHERE id = p_member_user_id;

  DELETE FROM public.team_members
  WHERE organizer_id = p_organizer_id
    AND user_id = p_member_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_team_member_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_team_member_access(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.remove_team_member_access(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member_access(uuid, uuid) TO service_role;