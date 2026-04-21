DROP FUNCTION IF EXISTS public.list_matches();

CREATE FUNCTION public.list_matches(
  p_event_id UUID DEFAULT NULL
) RETURNS TABLE (
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
  unread_count BIGINT,
  event_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_event_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = p_event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS match_id,
    m.event_id,
    CASE
      WHEN m.user_a_id = v_user_id THEN m.user_b_id
      ELSE m.user_a_id
    END AS partner_id,
    p.full_name AS partner_name,
    p.avatar_url AS partner_avatar,
    m.created_at,
    c.id AS chat_id,
    m.match_seen,
    m.chat_opened,
    (
      SELECT msg.content
      FROM public.messages msg
      WHERE msg.chat_id = c.id
      ORDER BY msg.created_at DESC
      LIMIT 1
    ) AS last_message,
    (
      SELECT msg.created_at
      FROM public.messages msg
      WHERE msg.chat_id = c.id
      ORDER BY msg.created_at DESC
      LIMIT 1
    ) AS last_message_time,
    (
      SELECT COUNT(*)
      FROM public.messages msg
      WHERE msg.chat_id = c.id
        AND msg.sender_id <> v_user_id
        AND msg.status IS DISTINCT FROM 'seen'
    ) AS unread_count,
    e.title AS event_title
  FROM public.matches m
  JOIN public.profiles p
    ON (
      CASE
        WHEN m.user_a_id = v_user_id THEN m.user_b_id
        ELSE m.user_a_id
      END = p.id
    )
  LEFT JOIN public.chats c
    ON c.match_id = m.id
   AND c.event_id = m.event_id
  LEFT JOIN public.events e
    ON e.id = m.event_id
  WHERE (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND COALESCE(m.status, 'active') = 'active'
    AND (p_event_id IS NULL OR m.event_id = p_event_id)
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    )
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = m.user_a_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    )
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = m.user_b_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    )
  ORDER BY m.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_match_details(
  p_match_id UUID
) RETURNS TABLE (
  match_id UUID,
  event_id UUID,
  event_title TEXT,
  partner_id UUID,
  partner_name TEXT,
  partner_avatar TEXT,
  created_at TIMESTAMPTZ,
  chat_id UUID,
  match_seen BOOLEAN,
  chat_opened BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS match_id,
    m.event_id,
    e.title AS event_title,
    CASE
      WHEN m.user_a_id = v_user_id THEN m.user_b_id
      ELSE m.user_a_id
    END AS partner_id,
    p.full_name AS partner_name,
    p.avatar_url AS partner_avatar,
    m.created_at,
    c.id AS chat_id,
    m.match_seen,
    m.chat_opened,
    m.status
  FROM public.matches m
  JOIN public.events e
    ON m.event_id = e.id
  JOIN public.profiles p
    ON (
      CASE
        WHEN m.user_a_id = v_user_id THEN m.user_b_id
        ELSE m.user_a_id
      END = p.id
    )
  LEFT JOIN public.chats c
    ON c.match_id = m.id
   AND c.event_id = m.event_id
  WHERE m.id = p_match_id
    AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND COALESCE(m.status, 'active') = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    )
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = m.user_a_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    )
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = m.user_b_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_received_likes(
  p_event_id UUID
) RETURNS TABLE (
  like_id UUID,
  from_user_id UUID,
  event_id UUID,
  created_at TIMESTAMPTZ,
  status TEXT,
  from_user_name TEXT,
  from_user_photo TEXT,
  from_user_age INTEGER,
  from_user_bio TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS like_id,
    l.from_user_id,
    l.event_id,
    l.created_at,
    l.status,
    p.full_name AS from_user_name,
    p.avatar_url AS from_user_photo,
    EXTRACT(YEAR FROM AGE(p.birth_date))::INT AS from_user_age,
    p.bio AS from_user_bio
  FROM public.likes l
  JOIN public.profiles p
    ON p.id = l.from_user_id
  JOIN public.event_participants ep_sender
    ON ep_sender.event_id = l.event_id
   AND ep_sender.user_id = l.from_user_id
  WHERE l.to_user_id = v_user_id
    AND l.event_id = p_event_id
    AND (l.status = 'pending' OR l.status IS NULL)
    AND COALESCE(ep_sender.status, 'confirmed') <> 'canceled'
    AND NOT EXISTS (
      SELECT 1
      FROM public.likes l2
      WHERE l2.from_user_id = v_user_id
        AND l2.to_user_id = l.from_user_id
        AND l2.event_id = p_event_id
    );
END;
$$;

DROP FUNCTION IF EXISTS public.ignore_like(UUID);

CREATE FUNCTION public.ignore_like(
  p_like_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.likes l
  SET status = 'ignored'
  WHERE l.id = p_like_id
    AND l.to_user_id = v_user_id
    AND (p_event_id IS NULL OR l.event_id = p_event_id)
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = l.event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    );
END;
$$;

DROP FUNCTION IF EXISTS public.mark_match_seen(UUID);

CREATE FUNCTION public.mark_match_seen(
  p_match_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.matches m
  SET match_seen = true
  WHERE m.id = p_match_id
    AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND COALESCE(m.status, 'active') = 'active'
    AND (p_event_id IS NULL OR m.event_id = p_event_id)
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    );
END;
$$;

DROP FUNCTION IF EXISTS public.mark_chat_opened(UUID);

CREATE FUNCTION public.mark_chat_opened(
  p_match_id UUID,
  p_event_id UUID DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.matches m
  SET chat_opened = true
  WHERE m.id = p_match_id
    AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND COALESCE(m.status, 'active') = 'active'
    AND (p_event_id IS NULL OR m.event_id = p_event_id)
    AND EXISTS (
      SELECT 1
      FROM public.event_participants ep
      WHERE ep.event_id = m.event_id
        AND ep.user_id = v_user_id
        AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_received_likes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignore_like(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_match_seen(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_opened(UUID, UUID) TO authenticated;
