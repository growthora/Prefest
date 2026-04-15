ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS unmatched_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS unmatched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS match_seen BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS chat_opened BOOLEAN DEFAULT false;

ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.list_event_matches(
  p_event_id UUID
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
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.list_matches() AS event_match
  WHERE event_match.event_id = p_event_id
  ORDER BY event_match.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.like_user(
  p_event_id UUID,
  p_to_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_user_id UUID := auth.uid();
  v_like_id UUID;
  v_inverse_like_exists BOOLEAN;
  v_match_id UUID;
  v_chat_id UUID;
  v_user_a_id UUID;
  v_user_b_id UUID;
  v_event_title TEXT;
  v_existing_match_status TEXT;
  v_should_emit_match_notification BOOLEAN := FALSE;
BEGIN
  IF v_from_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User not authenticated');
  END IF;

  IF v_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Cannot like yourself');
  END IF;

  IF v_from_user_id < p_to_user_id THEN
    v_user_a_id := v_from_user_id;
    v_user_b_id := p_to_user_id;
  ELSE
    v_user_a_id := p_to_user_id;
    v_user_b_id := v_from_user_id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      format('match:%s:%s:%s', p_event_id, v_user_a_id, v_user_b_id),
      0
    )
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_from_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'You must have a confirmed ticket for this event');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = p_to_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Target user is not available in this event');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_from_user_id
      AND match_enabled = true
      AND allow_profile_view = true
      AND public.has_valid_match_photo(avatar_url)
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Adicione uma foto de perfil valida para participar do Match');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_to_user_id
      AND match_enabled = true
      AND allow_profile_view = true
      AND public.has_valid_match_photo(avatar_url)
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not available for matching');
  END IF;

  SELECT title
  INTO v_event_title
  FROM public.events
  WHERE id = p_event_id;

  INSERT INTO public.likes (event_id, from_user_id, to_user_id)
  VALUES (p_event_id, v_from_user_id, p_to_user_id)
  ON CONFLICT (event_id, from_user_id, to_user_id) DO NOTHING
  RETURNING id INTO v_like_id;

  IF v_like_id IS NULL THEN
    RETURN jsonb_build_object('status', 'already_liked');
  END IF;

  DELETE FROM public.match_passes
  WHERE event_id = p_event_id
    AND (
      (from_user_id = v_from_user_id AND to_user_id = p_to_user_id)
      OR
      (from_user_id = p_to_user_id AND to_user_id = v_from_user_id)
    );

  SELECT EXISTS (
    SELECT 1
    FROM public.likes
    WHERE event_id = p_event_id
      AND from_user_id = p_to_user_id
      AND to_user_id = v_from_user_id
  )
  INTO v_inverse_like_exists;

  IF NOT v_inverse_like_exists THEN
    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES (
      p_to_user_id,
      'like',
      p_event_id,
      jsonb_build_object('message', 'Voce recebeu uma nova curtida!', 'event_name', v_event_title)
    );

    RETURN jsonb_build_object(
      'status', 'liked',
      'like_id', v_like_id
    );
  END IF;

  SELECT m.status
  INTO v_existing_match_status
  FROM public.matches m
  WHERE m.event_id = p_event_id
    AND m.user_a_id = v_user_a_id
    AND m.user_b_id = v_user_b_id
  FOR UPDATE;

  v_should_emit_match_notification :=
    v_existing_match_status IS NULL
    OR v_existing_match_status <> 'active';

  INSERT INTO public.matches (
    event_id,
    user_a_id,
    user_b_id,
    status,
    match_seen,
    chat_opened
  )
  VALUES (
    p_event_id,
    v_user_a_id,
    v_user_b_id,
    'active',
    false,
    false
  )
  ON CONFLICT (event_id, user_a_id, user_b_id)
  DO UPDATE SET
    status = 'active',
    unmatched_by = NULL,
    unmatched_at = NULL,
    match_seen = CASE
      WHEN matches.status IS DISTINCT FROM 'active' THEN false
      ELSE matches.match_seen
    END,
    chat_opened = CASE
      WHEN matches.status IS DISTINCT FROM 'active' THEN false
      ELSE matches.chat_opened
    END,
    created_at = CASE
      WHEN matches.status IS DISTINCT FROM 'active' THEN timezone('utc'::text, now())
      ELSE matches.created_at
    END
  RETURNING id INTO v_match_id;

  INSERT INTO public.chats (event_id, match_id, closed_at)
  VALUES (p_event_id, v_match_id, NULL)
  ON CONFLICT (event_id, match_id)
  DO UPDATE SET
    closed_at = NULL
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, v_user_a_id), (v_chat_id, v_user_b_id)
  ON CONFLICT DO NOTHING;

  IF v_should_emit_match_notification THEN
    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES
      (
        v_from_user_id,
        'match',
        p_event_id,
        jsonb_build_object(
          'match_id', v_match_id,
          'chat_id', v_chat_id,
          'event_name', v_event_title,
          'partner_id', p_to_user_id
        )
      ),
      (
        p_to_user_id,
        'match',
        p_event_id,
        jsonb_build_object(
          'match_id', v_match_id,
          'chat_id', v_chat_id,
          'event_name', v_event_title,
          'partner_id', v_from_user_id
        )
      );
  END IF;

  RETURN jsonb_build_object(
    'status', 'match',
    'like_id', v_like_id,
    'match_id', v_match_id,
    'chat_id', v_chat_id,
    'is_new_match', v_existing_match_status IS NULL,
    'match_reactivated', COALESCE(v_existing_match_status = 'inactive', false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_event_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_user(UUID, UUID) TO authenticated;
