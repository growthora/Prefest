CREATE FUNCTION public.list_matches()
RETURNS TABLE (
  match_id UUID,
  event_id UUID,
  partner_id UUID,
  partner_name TEXT,
  partner_avatar TEXT,
  created_at TIMESTAMPTZ,
  chat_id UUID,
  match_seen BOOLEAN,
  chat_opened BOOLEAN,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT *
  FROM public.list_matches(NULL::UUID);
$$;

CREATE FUNCTION public.ignore_like(
  p_like_id UUID
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.ignore_like(p_like_id, NULL::UUID);
$$;

CREATE FUNCTION public.mark_match_seen(
  p_match_id UUID
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.mark_match_seen(p_match_id, NULL::UUID);
$$;

CREATE FUNCTION public.mark_chat_opened(
  p_match_id UUID
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.mark_chat_opened(p_match_id, NULL::UUID);
$$;

GRANT EXECUTE ON FUNCTION public.list_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignore_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_match_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_opened(UUID) TO authenticated;
