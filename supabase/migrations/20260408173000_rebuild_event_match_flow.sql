-- Rebuild event match flow:
-- - persist skipped profiles per event
-- - expose versioned RPCs for candidates and received likes
-- - ensure likes only happen between confirmed attendees of the same event

CREATE TABLE IF NOT EXISTS public.match_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (event_id, from_user_id, to_user_id)
);

ALTER TABLE public.match_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own match passes" ON public.match_passes;
DROP POLICY IF EXISTS "Users can view their own match passes" ON public.match_passes;

CREATE POLICY "Users can insert their own match passes"
ON public.match_passes
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view their own match passes"
ON public.match_passes
FOR SELECT
USING (auth.uid() = from_user_id);

CREATE INDEX IF NOT EXISTS idx_match_passes_from_event
ON public.match_passes(from_user_id, event_id);

CREATE INDEX IF NOT EXISTS idx_match_passes_to_event
ON public.match_passes(to_user_id, event_id);

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

  INSERT INTO public.match_passes (event_id, from_user_id, to_user_id)
  VALUES (p_event_id, v_from_user_id, p_to_user_id)
  ON CONFLICT (event_id, from_user_id, to_user_id) DO NOTHING;
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
    AND COALESCE(p.match_enabled, false) = true
    AND COALESCE(p.allow_profile_view, true) = true
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
      WHERE m.event_id = p_event_id
        AND COALESCE(m.status, 'active') = 'active'
        AND (
          (m.user_a_id = v_user_id AND m.user_b_id = p.id)
          OR
          (m.user_b_id = v_user_id AND m.user_a_id = p.id)
        )
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
    AND COALESCE(sender.match_enabled, false) = true
    AND COALESCE(sender.allow_profile_view, true) = true
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
      WHERE m.event_id = l.event_id
        AND COALESCE(m.status, 'active') = 'active'
        AND (
          (m.user_a_id = v_user_id AND m.user_b_id = l.from_user_id)
          OR
          (m.user_b_id = v_user_id AND m.user_a_id = l.from_user_id)
        )
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
  v_existing_like UUID;
  v_inverse_like_exists BOOLEAN;
  v_match_id UUID;
  v_chat_id UUID;
  v_user_a_id UUID;
  v_user_b_id UUID;
  v_event_title TEXT;
  v_result JSONB;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_from_user_id
      AND match_enabled = true
      AND allow_profile_view = true
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'You have not enabled matching');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_to_user_id
      AND match_enabled = true
      AND allow_profile_view = true
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not available for matching');
  END IF;

  SELECT id
  INTO v_existing_like
  FROM public.likes
  WHERE event_id = p_event_id
    AND from_user_id = v_from_user_id
    AND to_user_id = p_to_user_id;

  IF v_existing_like IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_liked');
  END IF;

  DELETE FROM public.match_passes
  WHERE event_id = p_event_id
    AND from_user_id = v_from_user_id
    AND to_user_id = p_to_user_id;

  INSERT INTO public.likes (event_id, from_user_id, to_user_id)
  VALUES (p_event_id, v_from_user_id, p_to_user_id);

  SELECT title INTO v_event_title
  FROM public.events
  WHERE id = p_event_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.likes
    WHERE event_id = p_event_id
      AND from_user_id = p_to_user_id
      AND to_user_id = v_from_user_id
  )
  INTO v_inverse_like_exists;

  IF v_inverse_like_exists THEN
    IF v_from_user_id < p_to_user_id THEN
      v_user_a_id := v_from_user_id;
      v_user_b_id := p_to_user_id;
    ELSE
      v_user_a_id := p_to_user_id;
      v_user_b_id := v_from_user_id;
    END IF;

    INSERT INTO public.matches (event_id, user_a_id, user_b_id)
    VALUES (p_event_id, v_user_a_id, v_user_b_id)
    ON CONFLICT (event_id, user_a_id, user_b_id)
    DO UPDATE SET created_at = matches.created_at
    RETURNING id INTO v_match_id;

    INSERT INTO public.chats (event_id, match_id)
    VALUES (p_event_id, v_match_id)
    ON CONFLICT (event_id, match_id)
    DO UPDATE SET created_at = chats.created_at
    RETURNING id INTO v_chat_id;

    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (v_chat_id, v_user_a_id), (v_chat_id, v_user_b_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES
      (
        v_from_user_id,
        'match',
        p_event_id,
        jsonb_build_object('match_id', v_match_id, 'chat_id', v_chat_id, 'event_name', v_event_title, 'partner_id', p_to_user_id)
      ),
      (
        p_to_user_id,
        'match',
        p_event_id,
        jsonb_build_object('match_id', v_match_id, 'chat_id', v_chat_id, 'event_name', v_event_title, 'partner_id', v_from_user_id)
      );

    v_result := jsonb_build_object('status', 'match', 'match_id', v_match_id, 'chat_id', v_chat_id);
  ELSE
    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES (
      p_to_user_id,
      'like',
      p_event_id,
      jsonb_build_object('message', 'Você recebeu uma nova curtida!', 'event_name', v_event_title)
    );

    v_result := jsonb_build_object('status', 'liked');
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_match_candidate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_match_candidates_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_received_likes_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_user(UUID, UUID) TO authenticated;
