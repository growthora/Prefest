CREATE OR REPLACE FUNCTION public.reset_match_queue(
  p_event_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_deleted_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RAISE EXCEPTION 'Current user is not a confirmed attendee of this event';
  END IF;

  DELETE FROM public.match_passes pass_row
  WHERE pass_row.event_id = p_event_id
    AND pass_row.from_user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.likes inbound_like
      WHERE inbound_like.event_id = pass_row.event_id
        AND inbound_like.from_user_id = pass_row.to_user_id
        AND inbound_like.to_user_id = pass_row.from_user_id
    );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_match_queue(UUID) TO authenticated;
