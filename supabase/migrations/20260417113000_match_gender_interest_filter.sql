CREATE TABLE IF NOT EXISTS public.genders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  match_group TEXT NOT NULL CHECK (match_group IN ('homens', 'mulheres', 'outros')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.genders (code, label, match_group, sort_order)
VALUES
  ('homem_cis', 'Homem cis', 'homens', 10),
  ('homem_trans', 'Homem trans', 'homens', 20),
  ('mulher_cis', 'Mulher cis', 'mulheres', 30),
  ('mulher_trans', 'Mulher trans', 'mulheres', 40),
  ('nao_binario', 'Não binário', 'outros', 50),
  ('genero_fluido', 'Gênero fluido', 'outros', 60),
  ('agenero', 'Agênero', 'outros', 70),
  ('outro', 'Outro', 'outros', 80),
  ('prefiro_nao_informar', 'Prefiro não informar', 'outros', 90)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  match_group = EXCLUDED.match_group,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.profiles
ALTER COLUMN match_gender_preference DROP DEFAULT;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_match_gender_preference_check;

ALTER TABLE public.profiles
ALTER COLUMN match_gender_preference TYPE TEXT[]
USING (
  CASE
    WHEN match_gender_preference IS NULL OR btrim(match_gender_preference) = '' THEN NULL
    ELSE ARRAY[lower(match_gender_preference)]
  END
);

ALTER TABLE public.profiles
DISABLE TRIGGER enforce_profile_update_policy;

UPDATE public.profiles
SET match_gender_preference = ARRAY['todos']
WHERE match_gender_preference = ARRAY['todos'];

UPDATE public.profiles p
SET match_gender_preference = expanded.codes
FROM (
  SELECT
    source.id,
    ARRAY_AGG(g.code ORDER BY g.sort_order) AS codes
  FROM public.profiles source
  INNER JOIN public.genders g
    ON g.match_group = source.match_gender_preference[1]
  WHERE source.match_gender_preference[1] IN ('homens', 'mulheres')
  GROUP BY source.id
) AS expanded
WHERE p.id = expanded.id;

ALTER TABLE public.profiles
ALTER COLUMN match_gender_preference SET DEFAULT ARRAY['todos'];

ALTER TABLE public.profiles
ENABLE TRIGGER enforce_profile_update_policy;

CREATE OR REPLACE FUNCTION public.is_valid_match_gender_preference(
  p_preference TEXT[]
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p_preference IS NULL
    OR cardinality(p_preference) = 0
    OR (
      array_position(p_preference, 'todos') IS NOT NULL
      AND cardinality(p_preference) = 1
    )
    OR NOT EXISTS (
      SELECT 1
      FROM unnest(p_preference) AS preference_value
      WHERE
        NULLIF(btrim(preference_value), '') IS NULL
        OR lower(preference_value) = 'todos'
        OR NOT EXISTS (
          SELECT 1
          FROM public.genders g
          WHERE g.code = lower(preference_value)
        )
    );
$$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_match_gender_preference_check
CHECK (public.is_valid_match_gender_preference(match_gender_preference));

DROP FUNCTION IF EXISTS public.gender_preference_matches(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.gender_preference_matches(
  p_preference TEXT[],
  p_gender_identity TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_preference IS NULL OR cardinality(p_preference) = 0 THEN true
      WHEN EXISTS (
        SELECT 1
        FROM unnest(p_preference) AS preference_value
        WHERE lower(preference_value) = 'todos'
      ) THEN true
      WHEN p_gender_identity IS NULL OR btrim(p_gender_identity) = '' THEN false
      ELSE EXISTS (
        SELECT 1
        FROM unnest(p_preference) AS preference_value
        WHERE lower(preference_value) = lower(p_gender_identity)
      )
    END;
$$;

DROP FUNCTION IF EXISTS public.get_event_match_candidates_v2(UUID);

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
  match_gender_preference TEXT[],
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
  v_match_preference TEXT[] := ARRAY['todos'];
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles own_profile
    WHERE own_profile.id = v_user_id
      AND COALESCE(own_profile.match_enabled, false) = true
      AND COALESCE(own_profile.allow_profile_view, true) = true
      AND public.has_valid_match_photo(own_profile.avatar_url)
  ) THEN
    RETURN;
  END IF;

  SELECT
    CASE
      WHEN p.match_gender_preference IS NULL OR cardinality(p.match_gender_preference) = 0 THEN ARRAY['todos']
      ELSE ARRAY(
        SELECT DISTINCT lower(preference_value)
        FROM unnest(p.match_gender_preference) AS preference_value
        WHERE NULLIF(btrim(preference_value), '') IS NOT NULL
      )
    END
  INTO v_match_preference
  FROM public.profiles p
  WHERE p.id = v_user_id;

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
    AND public.has_valid_match_photo(p.avatar_url)
    AND public.gender_preference_matches(v_match_preference, p.gender_identity)
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
  v_match_preference TEXT[] := ARRAY['todos'];
  v_target_gender_identity TEXT;
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

  SELECT
    CASE
      WHEN p.match_gender_preference IS NULL OR cardinality(p.match_gender_preference) = 0 THEN ARRAY['todos']
      ELSE ARRAY(
        SELECT DISTINCT lower(preference_value)
        FROM unnest(p.match_gender_preference) AS preference_value
        WHERE NULLIF(btrim(preference_value), '') IS NOT NULL
      )
    END,
    p_target.gender_identity
  INTO
    v_match_preference,
    v_target_gender_identity
  FROM public.profiles p
  CROSS JOIN public.profiles p_target
  WHERE p.id = v_from_user_id
    AND p_target.id = p_to_user_id;

  IF NOT public.gender_preference_matches(v_match_preference, v_target_gender_identity) THEN
    RETURN jsonb_build_object(
      'status',
      'error',
      'message',
      'Essa pessoa nao corresponde ao filtro de interesse selecionado'
    );
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

  IF NOT v_inverse_like_exists THEN
    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES (
      p_to_user_id,
      'like',
      p_event_id,
      jsonb_build_object('message', 'Voce recebeu uma nova curtida!', 'event_name', v_event_title)
    );

    v_result := jsonb_build_object('status', 'liked');
  ELSE
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

    v_result := jsonb_build_object('status', 'match', 'match_id', v_match_id, 'chat_id', v_chat_id);
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gender_preference_matches(TEXT[], TEXT) TO authenticated;
