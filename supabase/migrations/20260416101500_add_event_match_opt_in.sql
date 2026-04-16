ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS match_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.event_participants ep
SET match_enabled = COALESCE(p.match_enabled, false)
FROM public.profiles p
WHERE p.id = ep.user_id
  AND ep.match_enabled IS DISTINCT FROM COALESCE(p.match_enabled, false);

CREATE OR REPLACE FUNCTION public.is_profile_complete_for_match(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND NULLIF(btrim(COALESCE(p.full_name, '')), '') IS NOT NULL
      AND COALESCE(length(regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g')), 0) IN (11, 14)
      AND COALESCE(length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')), 0) >= 10
      AND p.birth_date IS NOT NULL
      AND COALESCE(p.allow_profile_view, true) = true
      AND public.has_valid_match_photo(p.avatar_url)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_match_enabled(
  p_event_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = p_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
      AND COALESCE(ep.match_enabled, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.set_event_match_opt_in(
  p_event_id UUID,
  p_enabled BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_removed_likes INTEGER := 0;
  v_removed_passes INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User not authenticated');
  END IF;

  IF p_enabled IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Match opt-in invalido');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'You must have a confirmed ticket for this event');
  END IF;

  IF p_enabled AND NOT public.is_profile_complete_for_match(v_user_id) THEN
    RETURN jsonb_build_object(
      'status',
      'error',
      'message',
      'Complete seu perfil, mantenha uma foto valida e deixe o perfil visivel para entrar no Match'
    );
  END IF;

  UPDATE public.event_participants ep
  SET match_enabled = p_enabled
  WHERE ep.event_id = p_event_id
    AND ep.user_id = v_user_id
    AND COALESCE(ep.status, 'confirmed') <> 'canceled';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Nao foi possivel atualizar o Match deste evento');
  END IF;

  IF NOT p_enabled THEN
    DELETE FROM public.likes l
    WHERE l.event_id = p_event_id
      AND (l.from_user_id = v_user_id OR l.to_user_id = v_user_id);

    GET DIAGNOSTICS v_removed_likes = ROW_COUNT;

    DELETE FROM public.match_passes pass_row
    WHERE pass_row.event_id = p_event_id
      AND (pass_row.from_user_id = v_user_id OR pass_row.to_user_id = v_user_id);

    GET DIAGNOSTICS v_removed_passes = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'event_id', p_event_id,
    'user_id', v_user_id,
    'match_enabled', p_enabled,
    'removed_likes', v_removed_likes,
    'removed_passes', v_removed_passes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_match(
  p_user_a UUID,
  p_user_b UUID,
  p_event_id UUID
) RETURNS TABLE (
  match_id UUID,
  chat_id UUID,
  is_new_match BOOLEAN,
  match_reactivated BOOLEAN,
  event_link_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_low UUID;
  v_user_high UUID;
  v_match RECORD;
  v_chat_id UUID;
  v_link_row_count INTEGER := 0;
  v_link_created BOOLEAN := false;
  v_is_new_match BOOLEAN := false;
  v_match_reactivated BOOLEAN := false;
BEGIN
  IF p_user_a IS NULL OR p_user_b IS NULL OR p_event_id IS NULL THEN
    RAISE EXCEPTION 'user_a, user_b and event_id are required';
  END IF;

  IF p_user_a = p_user_b THEN
    RAISE EXCEPTION 'Cannot create a match with the same user twice';
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, p_user_a)
     OR NOT public.is_event_match_enabled(p_event_id, p_user_b) THEN
    RAISE EXCEPTION 'Both users must have Match ativo neste evento';
  END IF;

  v_user_low := LEAST(p_user_a, p_user_b);
  v_user_high := GREATEST(p_user_a, p_user_b);

  PERFORM pg_advisory_xact_lock(
    hashtextextended(format('global-match:%s:%s', v_user_low, v_user_high), 0)
  );

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE user1_id = v_user_low
    AND user2_id = v_user_high
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.matches (
      user1_id,
      user2_id,
      status,
      match_seen,
      chat_opened,
      created_at,
      last_interaction_at
    )
    VALUES (
      v_user_low,
      v_user_high,
      'active',
      false,
      false,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    RETURNING *
    INTO v_match;

    v_is_new_match := true;
  ELSIF COALESCE(v_match.status, 'active') <> 'active' THEN
    UPDATE public.matches
    SET
      status = 'active',
      unmatched_by = NULL,
      unmatched_at = NULL,
      match_seen = false,
      chat_opened = false,
      last_interaction_at = timezone('utc'::text, now())
    WHERE id = v_match.id
    RETURNING *
    INTO v_match;

    v_match_reactivated := true;
  ELSE
    UPDATE public.matches
    SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, timezone('utc'::text, now())), timezone('utc'::text, now()))
    WHERE id = v_match.id
    RETURNING *
    INTO v_match;
  END IF;

  INSERT INTO public.match_events (match_id, event_id)
  VALUES (v_match.id, p_event_id)
  ON CONFLICT (match_id, event_id) DO NOTHING;

  GET DIAGNOSTICS v_link_row_count = ROW_COUNT;
  v_link_created := v_link_row_count > 0;

  SELECT c.id
  INTO v_chat_id
  FROM public.chats c
  WHERE c.match_id = v_match.id
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (match_id, created_at, closed_at)
    VALUES (v_match.id, timezone('utc'::text, now()), NULL)
    RETURNING id
    INTO v_chat_id;
  ELSE
    UPDATE public.chats
    SET closed_at = NULL
    WHERE id = v_chat_id;
  END IF;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, v_user_low), (v_chat_id, v_user_high)
  ON CONFLICT (chat_id, user_id) DO UPDATE
  SET deleted_at = NULL;

  RETURN QUERY
  SELECT
    v_match.id,
    v_chat_id,
    v_is_new_match,
    v_match_reactivated,
    v_link_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_event_matches(
  p_event_id UUID
) RETURNS TABLE (
  match_id UUID,
  partner_id UUID,
  partner_name TEXT,
  partner_avatar TEXT,
  created_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  chat_id UUID,
  match_seen BOOLEAN,
  chat_opened BOOLEAN,
  status TEXT,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count BIGINT,
  event_id UUID,
  event_title TEXT,
  event_ids UUID[],
  event_titles TEXT[],
  event_count INTEGER,
  events JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT match_row.*
  FROM public.list_matches() AS match_row
  WHERE public.is_event_match_enabled(p_event_id, auth.uid())
    AND p_event_id = ANY(COALESCE(match_row.event_ids, ARRAY[]::UUID[]))
  ORDER BY COALESCE(match_row.last_message_time, match_row.last_interaction_at, match_row.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.skip_match_candidate(
  p_event_id UUID,
  p_to_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_user_id UUID := auth.uid();
BEGIN
  IF v_from_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF v_from_user_id = p_to_user_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_from_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
    RAISE EXCEPTION 'Current user is not a confirmed attendee of this event';
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, v_from_user_id) THEN
    RAISE EXCEPTION 'Ative o Match deste evento para continuar';
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, p_to_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.match_passes (event_id, from_user_id, to_user_id)
  VALUES (p_event_id, v_from_user_id, p_to_user_id)
  ON CONFLICT (event_id, from_user_id, to_user_id) DO NOTHING;
END;
$$;

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

  IF NOT public.is_event_match_enabled(p_event_id, v_user_id) THEN
    RAISE EXCEPTION 'Ative o Match deste evento para continuar';
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

CREATE OR REPLACE FUNCTION public.get_event_match_candidates_v2(
  p_event_id UUID
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  age INTEGER,
  height NUMERIC,
  relationship_status TEXT,
  match_intention TEXT,
  match_gender_preference TEXT,
  gender_identity TEXT,
  sexuality TEXT,
  vibes TEXT[],
  last_seen TIMESTAMPTZ,
  is_online BOOLEAN,
  show_initials_only BOOLEAN,
  single_mode BOOLEAN,
  liked_you BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, v_user_id) THEN
    RETURN;
  END IF;

  IF NOT public.is_profile_complete_for_match(v_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    CASE
      WHEN p.birth_date IS NULL THEN NULL
      ELSE EXTRACT(YEAR FROM age(current_date, p.birth_date))::INTEGER
    END AS age,
    p.height,
    p.relationship_status,
    p.match_intention,
    p.match_gender_preference,
    p.gender_identity,
    p.sexuality,
    COALESCE(p.vibes, ARRAY[]::TEXT[]) AS vibes,
    p.last_seen,
    COALESCE(p.last_seen > now() - INTERVAL '5 minutes', false) AS is_online,
    COALESCE(p.show_initials_only, false) AS show_initials_only,
    COALESCE(p.single_mode, false) AS single_mode,
    EXISTS (
      SELECT 1
      FROM public.likes inbound_like
      WHERE inbound_like.event_id = p_event_id
        AND inbound_like.from_user_id = p.id
        AND inbound_like.to_user_id = v_user_id
    ) AS liked_you
  FROM public.event_participants ep
  INNER JOIN public.profiles p
    ON p.id = ep.user_id
  WHERE ep.event_id = p_event_id
    AND ep.user_id <> v_user_id
    AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    AND COALESCE(ep.match_enabled, false) = true
    AND public.is_profile_complete_for_match(p.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.likes own_like
      WHERE own_like.event_id = p_event_id
        AND own_like.from_user_id = v_user_id
        AND own_like.to_user_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.match_passes pass_row
      WHERE pass_row.event_id = p_event_id
        AND pass_row.from_user_id = v_user_id
        AND pass_row.to_user_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE COALESCE(m.status, 'active') = 'active'
        AND m.user1_id = LEAST(v_user_id, p.id)
        AND m.user2_id = GREATEST(v_user_id, p.id)
    )
  ORDER BY
    liked_you DESC,
    is_online DESC,
    p.last_seen DESC NULLS LAST,
    ep.joined_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_received_likes_v2(
  p_event_id UUID
) RETURNS TABLE (
  like_id UUID,
  from_user_id UUID,
  from_user_name TEXT,
  from_user_photo TEXT,
  from_user_bio TEXT,
  from_user_age INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, v_user_id) THEN
    RETURN;
  END IF;

  IF NOT public.is_profile_complete_for_match(v_user_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS like_id,
    sender.id AS from_user_id,
    sender.full_name AS from_user_name,
    sender.avatar_url AS from_user_photo,
    sender.bio AS from_user_bio,
    CASE
      WHEN sender.birth_date IS NULL THEN NULL
      ELSE EXTRACT(YEAR FROM age(current_date, sender.birth_date))::INTEGER
    END AS from_user_age,
    l.created_at
  FROM public.likes l
  INNER JOIN public.profiles sender
    ON sender.id = l.from_user_id
  INNER JOIN public.event_participants ep
    ON ep.event_id = l.event_id
   AND ep.user_id = l.from_user_id
  WHERE l.event_id = p_event_id
    AND l.to_user_id = v_user_id
    AND COALESCE(ep.status, 'confirmed') <> 'canceled'
    AND COALESCE(ep.match_enabled, false) = true
    AND public.is_profile_complete_for_match(sender.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.match_passes pass_row
      WHERE pass_row.event_id = l.event_id
        AND pass_row.from_user_id = v_user_id
        AND pass_row.to_user_id = l.from_user_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE COALESCE(m.status, 'active') = 'active'
        AND m.user1_id = LEAST(v_user_id, l.from_user_id)
        AND m.user2_id = GREATEST(v_user_id, l.from_user_id)
    )
  ORDER BY l.created_at DESC;
END;
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
  v_event_title TEXT;
  v_match_result RECORD;
BEGIN
  IF v_from_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User not authenticated');
  END IF;

  IF v_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Cannot like yourself');
  END IF;

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

  IF NOT public.is_event_match_enabled(p_event_id, v_from_user_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Ative o Match deste evento para curtir perfis');
  END IF;

  IF NOT public.is_event_match_enabled(p_event_id, p_to_user_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Essa pessoa nao esta participando do Match neste evento');
  END IF;

  IF NOT public.is_profile_complete_for_match(v_from_user_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Complete seu perfil e adicione uma foto valida para participar do Match');
  END IF;

  IF NOT public.is_profile_complete_for_match(p_to_user_id) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not available for matching');
  END IF;

  SELECT e.title
  INTO v_event_title
  FROM public.events e
  WHERE e.id = p_event_id;

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
      OR (from_user_id = p_to_user_id AND to_user_id = v_from_user_id)
    );

  SELECT EXISTS (
    SELECT 1
    FROM public.likes inverse_like
    WHERE inverse_like.event_id = p_event_id
      AND inverse_like.from_user_id = p_to_user_id
      AND inverse_like.to_user_id = v_from_user_id
  )
  INTO v_inverse_like_exists;

  IF NOT v_inverse_like_exists THEN
    RETURN jsonb_build_object(
      'status', 'liked',
      'like_id', v_like_id,
      'event_title', v_event_title
    );
  END IF;

  SELECT *
  INTO v_match_result
  FROM public.handle_match(v_from_user_id, p_to_user_id, p_event_id);

  RETURN jsonb_build_object(
    'status', 'match',
    'like_id', v_like_id,
    'match_id', v_match_result.match_id,
    'chat_id', v_match_result.chat_id,
    'is_new_match', COALESCE(v_match_result.is_new_match, false),
    'match_reactivated', COALESCE(v_match_result.match_reactivated, false),
    'event_link_created', COALESCE(v_match_result.event_link_created, false),
    'event_title', v_event_title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_complete_for_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_match_enabled(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_event_match_opt_in(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_match(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_event_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_match_candidate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_match_queue(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_match_candidates_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_received_likes_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_user(UUID, UUID) TO authenticated;
