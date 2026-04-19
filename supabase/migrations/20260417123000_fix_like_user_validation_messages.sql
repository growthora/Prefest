CREATE OR REPLACE FUNCTION public.like_user(p_event_id uuid, p_to_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Complete seu perfil para participar do Match');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_from_user_id
      AND match_enabled = true
      AND allow_profile_view = true
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Ative sua visibilidade no Match para curtir participantes');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_from_user_id
      AND public.has_valid_match_photo(avatar_url)
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Adicione uma foto de perfil válida para participar do Match');
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
$function$;
