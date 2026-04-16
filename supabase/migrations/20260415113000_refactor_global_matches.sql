SET search_path = public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Refactor match lifecycle to a global user-pair model.
-- Result:
-- 1. A pair of users has exactly one match row.
-- 2. Events are linked through match_events.
-- 3. Chats are unique per match_id (global conversation).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'user_a_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'user1_id'
  ) THEN
    ALTER TABLE public.matches RENAME COLUMN user_a_id TO user1_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'user_b_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'user2_id'
  ) THEN
    ALTER TABLE public.matches RENAME COLUMN user_b_id TO user2_id;
  END IF;
END $$;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS unmatched_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS unmatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS match_seen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_opened boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz DEFAULT timezone('utc'::text, now());

UPDATE public.matches
SET
  status = COALESCE(status, 'active'),
  match_seen = COALESCE(match_seen, false),
  chat_opened = COALESCE(chat_opened, false),
  last_interaction_at = COALESCE(last_interaction_at, created_at, timezone('utc'::text, now()))
WHERE status IS NULL
   OR match_seen IS NULL
   OR chat_opened IS NULL
   OR last_interaction_at IS NULL;

ALTER TABLE public.matches
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN match_seen SET DEFAULT false,
  ALTER COLUMN match_seen SET NOT NULL,
  ALTER COLUMN chat_opened SET DEFAULT false,
  ALTER COLUMN chat_opened SET NOT NULL,
  ALTER COLUMN last_interaction_at SET DEFAULT timezone('utc'::text, now()),
  ALTER COLUMN last_interaction_at SET NOT NULL;

ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET status = COALESCE(status, 'sent')
WHERE status IS NULL;

ALTER TABLE public.messages
  ALTER COLUMN status SET DEFAULT 'sent';

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.chats
  ALTER COLUMN event_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT match_events_match_id_event_id_key UNIQUE (match_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_match_events_match_id
  ON public.match_events(match_id);

CREATE INDEX IF NOT EXISTS idx_match_events_event_id
  ON public.match_events(event_id);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_match_events_select_own_match ON public.match_events;
CREATE POLICY rls_match_events_select_own_match
ON public.match_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_events.match_id
      AND auth.uid() IN (m.user1_id, m.user2_id)
  )
);

CREATE TEMP TABLE tmp_match_rollup AS
WITH match_message_stats AS (
  SELECT
    m.id AS match_id,
    COALESCE(MAX(msg.created_at), MAX(c.created_at), m.last_interaction_at, m.created_at) AS interaction_at
  FROM public.matches m
  LEFT JOIN public.chats c
    ON c.match_id = m.id
  LEFT JOIN public.messages msg
    ON msg.chat_id = c.id
  GROUP BY m.id, m.last_interaction_at, m.created_at
),
ranked_matches AS (
  SELECT
    m.id AS match_id,
    m.user1_id,
    m.user2_id,
    FIRST_VALUE(m.id) OVER (
      PARTITION BY m.user1_id, m.user2_id
      ORDER BY
        CASE WHEN COALESCE(m.status, 'active') = 'active' THEN 0 ELSE 1 END,
        COALESCE(ms.interaction_at, m.created_at) DESC,
        m.created_at ASC,
        m.id ASC
    ) AS canonical_match_id,
    MIN(m.created_at) OVER (
      PARTITION BY m.user1_id, m.user2_id
    ) AS merged_created_at,
    MAX(ms.interaction_at) OVER (
      PARTITION BY m.user1_id, m.user2_id
    ) AS merged_last_interaction_at,
    BOOL_OR(COALESCE(m.status, 'active') = 'active') OVER (
      PARTITION BY m.user1_id, m.user2_id
    ) AS has_active_match,
    BOOL_OR(COALESCE(m.match_seen, false)) OVER (
      PARTITION BY m.user1_id, m.user2_id
    ) AS merged_match_seen,
    BOOL_OR(COALESCE(m.chat_opened, false)) OVER (
      PARTITION BY m.user1_id, m.user2_id
    ) AS merged_chat_opened,
    FIRST_VALUE(m.unmatched_by) OVER (
      PARTITION BY m.user1_id, m.user2_id
      ORDER BY m.unmatched_at DESC NULLS LAST, m.created_at DESC, m.id DESC
    ) AS latest_unmatched_by,
    FIRST_VALUE(m.unmatched_at) OVER (
      PARTITION BY m.user1_id, m.user2_id
      ORDER BY m.unmatched_at DESC NULLS LAST, m.created_at DESC, m.id DESC
    ) AS latest_unmatched_at
  FROM public.matches m
  LEFT JOIN match_message_stats ms
    ON ms.match_id = m.id
)
SELECT DISTINCT ON (match_id)
  match_id,
  canonical_match_id,
  merged_created_at,
  merged_last_interaction_at,
  has_active_match,
  merged_match_seen,
  merged_chat_opened,
  latest_unmatched_by,
  latest_unmatched_at
FROM ranked_matches
ORDER BY match_id;

CREATE TEMP TABLE tmp_match_canonical AS
SELECT DISTINCT ON (canonical_match_id)
  canonical_match_id,
  merged_created_at,
  merged_last_interaction_at,
  has_active_match,
  merged_match_seen,
  merged_chat_opened,
  latest_unmatched_by,
  latest_unmatched_at
FROM tmp_match_rollup
ORDER BY canonical_match_id;

INSERT INTO public.match_events (match_id, event_id, created_at)
SELECT
  rollup.canonical_match_id,
  m.event_id,
  COALESCE(m.created_at, timezone('utc'::text, now()))
FROM public.matches m
INNER JOIN tmp_match_rollup rollup
  ON rollup.match_id = m.id
WHERE m.event_id IS NOT NULL
ON CONFLICT (match_id, event_id) DO NOTHING;

CREATE TEMP TABLE tmp_chat_rollup AS
WITH chat_message_stats AS (
  SELECT
    c.id AS chat_id,
    COALESCE(MAX(msg.created_at), c.created_at) AS interaction_at
  FROM public.chats c
  LEFT JOIN public.messages msg
    ON msg.chat_id = c.id
  GROUP BY c.id, c.created_at
),
ranked_chats AS (
  SELECT
    c.id AS chat_id,
    rollup.canonical_match_id,
    FIRST_VALUE(c.id) OVER (
      PARTITION BY rollup.canonical_match_id
      ORDER BY
        CASE WHEN c.closed_at IS NULL THEN 0 ELSE 1 END,
        COALESCE(cms.interaction_at, c.created_at) DESC,
        c.created_at ASC,
        c.id ASC
    ) AS canonical_chat_id,
    MIN(c.created_at) OVER (
      PARTITION BY rollup.canonical_match_id
    ) AS merged_chat_created_at,
    BOOL_OR(c.closed_at IS NULL) OVER (
      PARTITION BY rollup.canonical_match_id
    ) AS has_open_chat,
    MAX(c.closed_at) OVER (
      PARTITION BY rollup.canonical_match_id
    ) AS latest_closed_at
  FROM public.chats c
  INNER JOIN tmp_match_rollup rollup
    ON rollup.match_id = c.match_id
  LEFT JOIN chat_message_stats cms
    ON cms.chat_id = c.id
)
SELECT DISTINCT ON (chat_id)
  chat_id,
  canonical_match_id,
  canonical_chat_id,
  merged_chat_created_at,
  has_open_chat,
  latest_closed_at
FROM ranked_chats
ORDER BY chat_id;

INSERT INTO public.chats (match_id, created_at, closed_at)
SELECT
  canonical.canonical_match_id,
  canonical.merged_created_at,
  CASE
    WHEN canonical.has_active_match THEN NULL
    ELSE canonical.latest_unmatched_at
  END
FROM tmp_match_canonical canonical
LEFT JOIN (
  SELECT DISTINCT canonical_match_id
  FROM tmp_chat_rollup
) existing_chat
  ON existing_chat.canonical_match_id = canonical.canonical_match_id
WHERE existing_chat.canonical_match_id IS NULL;

CREATE TEMP TABLE tmp_canonical_chat AS
SELECT DISTINCT ON (match_id)
  match_id AS canonical_match_id,
  id AS canonical_chat_id
FROM public.chats
WHERE match_id IN (
  SELECT canonical_match_id
  FROM tmp_match_canonical
)
ORDER BY match_id, created_at ASC, id ASC;

CREATE TEMP TABLE tmp_chat_map AS
SELECT
  c.id AS source_chat_id,
  canonical.canonical_chat_id,
  canonical.canonical_match_id
FROM public.chats c
INNER JOIN tmp_match_rollup rollup
  ON rollup.match_id = c.match_id
INNER JOIN tmp_canonical_chat canonical
  ON canonical.canonical_match_id = rollup.canonical_match_id;

WITH canonical_chat_aggregate AS (
  SELECT
    map.canonical_chat_id,
    MIN(c.created_at) AS merged_created_at,
    BOOL_OR(c.closed_at IS NULL) AS has_open_chat,
    MAX(c.closed_at) AS latest_closed_at
  FROM tmp_chat_map map
  INNER JOIN public.chats c
    ON c.id = map.source_chat_id
  GROUP BY map.canonical_chat_id
)
UPDATE public.chats c
SET
  match_id = canonical.canonical_match_id,
  created_at = COALESCE(agg.merged_created_at, c.created_at),
  closed_at = CASE
    WHEN match_state.has_active_match OR COALESCE(agg.has_open_chat, false) THEN NULL
    ELSE COALESCE(match_state.latest_unmatched_at, agg.latest_closed_at, c.closed_at)
  END
FROM tmp_canonical_chat canonical
INNER JOIN tmp_match_canonical match_state
  ON match_state.canonical_match_id = canonical.canonical_match_id
LEFT JOIN canonical_chat_aggregate agg
  ON agg.canonical_chat_id = canonical.canonical_chat_id
WHERE c.id = canonical.canonical_chat_id;

UPDATE public.messages msg
SET chat_id = map.canonical_chat_id
FROM tmp_chat_map map
WHERE msg.chat_id = map.source_chat_id
  AND map.source_chat_id <> map.canonical_chat_id;

UPDATE public.user_presence presence
SET active_chat_id = map.canonical_chat_id
FROM tmp_chat_map map
WHERE presence.active_chat_id = map.source_chat_id
  AND map.source_chat_id <> map.canonical_chat_id;

WITH participant_rollup AS (
  SELECT
    map.canonical_chat_id AS chat_id,
    cp.user_id,
    MIN(cp.created_at) AS created_at,
    CASE
      WHEN COUNT(*) FILTER (WHERE cp.deleted_at IS NULL) > 0 THEN NULL
      ELSE MAX(cp.deleted_at)
    END AS deleted_at
  FROM public.chat_participants cp
  INNER JOIN tmp_chat_map map
    ON map.source_chat_id = cp.chat_id
  GROUP BY map.canonical_chat_id, cp.user_id
)
INSERT INTO public.chat_participants (chat_id, user_id, created_at, deleted_at)
SELECT
  chat_id,
  user_id,
  created_at,
  deleted_at
FROM participant_rollup
ON CONFLICT (chat_id, user_id) DO UPDATE
SET deleted_at = CASE
  WHEN public.chat_participants.deleted_at IS NULL OR EXCLUDED.deleted_at IS NULL THEN NULL
  ELSE GREATEST(public.chat_participants.deleted_at, EXCLUDED.deleted_at)
END;

UPDATE public.notifications n
SET payload = jsonb_set(n.payload, '{match_id}', to_jsonb(rollup.canonical_match_id::text), true)
FROM tmp_match_rollup rollup
WHERE n.type = 'match'
  AND n.payload ? 'match_id'
  AND (n.payload ->> 'match_id')::uuid = rollup.match_id
  AND rollup.match_id <> rollup.canonical_match_id;

UPDATE public.notifications n
SET payload = jsonb_set(n.payload, '{chat_id}', to_jsonb(map.canonical_chat_id::text), true)
FROM tmp_chat_map map
WHERE n.type = 'match'
  AND n.payload ? 'chat_id'
  AND (n.payload ->> 'chat_id')::uuid = map.source_chat_id
  AND map.source_chat_id <> map.canonical_chat_id;

UPDATE public.matches m
SET
  created_at = canonical.merged_created_at,
  last_interaction_at = COALESCE(canonical.merged_last_interaction_at, canonical.merged_created_at),
  status = CASE
    WHEN canonical.has_active_match THEN 'active'
    ELSE 'inactive'
  END,
  unmatched_by = CASE
    WHEN canonical.has_active_match THEN NULL
    ELSE canonical.latest_unmatched_by
  END,
  unmatched_at = CASE
    WHEN canonical.has_active_match THEN NULL
    ELSE canonical.latest_unmatched_at
  END,
  match_seen = canonical.merged_match_seen,
  chat_opened = canonical.merged_chat_opened
FROM tmp_match_canonical canonical
WHERE m.id = canonical.canonical_match_id;

DELETE FROM public.chats c
USING tmp_chat_map map
WHERE c.id = map.source_chat_id
  AND map.source_chat_id <> map.canonical_chat_id;

DELETE FROM public.matches m
USING tmp_match_rollup rollup
WHERE m.id = rollup.match_id
  AND rollup.match_id <> rollup.canonical_match_id;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_event_id_match_id_key;

DROP INDEX IF EXISTS idx_chats_match_id_unique;
CREATE UNIQUE INDEX idx_chats_match_id_unique
  ON public.chats(match_id);

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_users_order,
  DROP CONSTRAINT IF EXISTS matches_user_pair_order,
  DROP CONSTRAINT IF EXISTS matches_event_id_user_a_id_user_b_id_key,
  DROP CONSTRAINT IF EXISTS matches_event_id_user1_id_user2_id_key;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_user_pair_order CHECK (user1_id < user2_id);

DROP INDEX IF EXISTS idx_matches_users;
DROP INDEX IF EXISTS idx_matches_unique_pair;
CREATE UNIQUE INDEX idx_matches_unique_pair
  ON public.matches (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id));

CREATE INDEX IF NOT EXISTS idx_matches_user1_status_last_interaction
  ON public.matches(user1_id, status, last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_user2_status_last_interaction
  ON public.matches(user2_id, status, last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_last_interaction
  ON public.matches(last_interaction_at DESC);

DROP FUNCTION IF EXISTS public.list_event_matches(UUID);
DROP FUNCTION IF EXISTS public.list_matches();
DROP FUNCTION IF EXISTS public.get_match_details(UUID);
DROP FUNCTION IF EXISTS public.get_or_create_chat(UUID);
DROP FUNCTION IF EXISTS public.unmatch_user(UUID);
DROP FUNCTION IF EXISTS public.like_user(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_event_match_candidates_v2(UUID);
DROP FUNCTION IF EXISTS public.get_event_received_likes_v2(UUID);

ALTER TABLE public.matches
  DROP COLUMN IF EXISTS event_id;

ALTER TABLE public.chats
  DROP COLUMN IF EXISTS event_id;

DROP POLICY IF EXISTS "Users can view their matches" ON public.matches;
DROP POLICY IF EXISTS rls_matches_select_self ON public.matches;
CREATE POLICY rls_matches_select_self
ON public.matches
FOR SELECT
USING (auth.uid() IN (user1_id, user2_id));

DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.chats;
DROP POLICY IF EXISTS rls_chats_select_participants ON public.chats;
CREATE POLICY rls_chats_select_participants
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_participants cp
    WHERE cp.chat_id = chats.id
      AND cp.user_id = auth.uid()
  )
);

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
      AND COALESCE(p.match_enabled, false) = true
      AND COALESCE(p.allow_profile_view, true) = true
      AND public.has_valid_match_photo(p.avatar_url)
  );
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

CREATE OR REPLACE FUNCTION public.list_matches()
RETURNS TABLE (
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
  WITH current_user AS (
    SELECT auth.uid() AS user_id
  )
  SELECT
    m.id AS match_id,
    partner.id AS partner_id,
    partner.full_name AS partner_name,
    partner.avatar_url AS partner_avatar,
    m.created_at,
    COALESCE(m.last_interaction_at, m.created_at) AS last_interaction_at,
    c.id AS chat_id,
    COALESCE(m.match_seen, false) AS match_seen,
    COALESCE(m.chat_opened, false) AS chat_opened,
    COALESCE(m.status, 'active') AS status,
    last_message.content AS last_message,
    last_message.created_at AS last_message_time,
    COALESCE(unread_messages.unread_count, 0)::bigint AS unread_count,
    event_bundle.primary_event_id AS event_id,
    event_bundle.primary_event_title AS event_title,
    event_bundle.event_ids,
    event_bundle.event_titles,
    COALESCE(array_length(event_bundle.event_ids, 1), 0) AS event_count,
    event_bundle.events
  FROM current_user cu
  INNER JOIN public.matches m
    ON cu.user_id IN (m.user1_id, m.user2_id)
  INNER JOIN public.profiles partner
    ON partner.id = CASE
      WHEN m.user1_id = cu.user_id THEN m.user2_id
      ELSE m.user1_id
    END
  LEFT JOIN public.chats c
    ON c.match_id = m.id
  LEFT JOIN LATERAL (
    SELECT
      msg.content,
      msg.created_at
    FROM public.messages msg
    WHERE msg.chat_id = c.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) last_message
    ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.messages msg
    WHERE msg.chat_id = c.id
      AND msg.sender_id <> cu.user_id
      AND COALESCE(msg.status, 'sent') <> 'seen'
  ) unread_messages
    ON true
  LEFT JOIN LATERAL (
    SELECT
      ordered_events.event_ids,
      ordered_events.event_titles,
      ordered_events.events,
      ordered_events.event_ids[1] AS primary_event_id,
      ordered_events.event_titles[1] AS primary_event_title
    FROM (
      SELECT
        array_agg(event_row.event_id ORDER BY event_row.sort_at DESC, event_row.event_title) AS event_ids,
        array_agg(event_row.event_title ORDER BY event_row.sort_at DESC, event_row.event_title) AS event_titles,
        jsonb_agg(
          jsonb_build_object(
            'event_id', event_row.event_id,
            'event_title', event_row.event_title
          )
          ORDER BY event_row.sort_at DESC, event_row.event_title
        ) AS events
      FROM (
        SELECT DISTINCT
          me.event_id,
          e.title AS event_title,
          COALESCE(me.created_at, e.created_at, m.created_at) AS sort_at
        FROM public.match_events me
        INNER JOIN public.events e
          ON e.id = me.event_id
        WHERE me.match_id = m.id
      ) event_row
    ) ordered_events
  ) event_bundle
    ON true
  WHERE COALESCE(m.status, 'active') = 'active'
  ORDER BY COALESCE(last_message.created_at, m.last_interaction_at, m.created_at) DESC;
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
  WHERE p_event_id = ANY(match_row.event_ids)
  ORDER BY COALESCE(match_row.last_message_time, match_row.last_interaction_at, match_row.created_at) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_match_details(
  p_match_id UUID
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
  WITH current_user AS (
    SELECT auth.uid() AS user_id
  )
  SELECT
    m.id AS match_id,
    partner.id AS partner_id,
    partner.full_name AS partner_name,
    partner.avatar_url AS partner_avatar,
    m.created_at,
    COALESCE(m.last_interaction_at, m.created_at) AS last_interaction_at,
    c.id AS chat_id,
    COALESCE(m.match_seen, false) AS match_seen,
    COALESCE(m.chat_opened, false) AS chat_opened,
    COALESCE(m.status, 'active') AS status,
    last_message.content AS last_message,
    last_message.created_at AS last_message_time,
    COALESCE(unread_messages.unread_count, 0)::bigint AS unread_count,
    event_bundle.primary_event_id AS event_id,
    event_bundle.primary_event_title AS event_title,
    event_bundle.event_ids,
    event_bundle.event_titles,
    COALESCE(array_length(event_bundle.event_ids, 1), 0) AS event_count,
    event_bundle.events
  FROM current_user cu
  INNER JOIN public.matches m
    ON m.id = p_match_id
   AND cu.user_id IN (m.user1_id, m.user2_id)
  INNER JOIN public.profiles partner
    ON partner.id = CASE
      WHEN m.user1_id = cu.user_id THEN m.user2_id
      ELSE m.user1_id
    END
  LEFT JOIN public.chats c
    ON c.match_id = m.id
  LEFT JOIN LATERAL (
    SELECT
      msg.content,
      msg.created_at
    FROM public.messages msg
    WHERE msg.chat_id = c.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) last_message
    ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.messages msg
    WHERE msg.chat_id = c.id
      AND msg.sender_id <> cu.user_id
      AND COALESCE(msg.status, 'sent') <> 'seen'
  ) unread_messages
    ON true
  LEFT JOIN LATERAL (
    SELECT
      ordered_events.event_ids,
      ordered_events.event_titles,
      ordered_events.events,
      ordered_events.event_ids[1] AS primary_event_id,
      ordered_events.event_titles[1] AS primary_event_title
    FROM (
      SELECT
        array_agg(event_row.event_id ORDER BY event_row.sort_at DESC, event_row.event_title) AS event_ids,
        array_agg(event_row.event_title ORDER BY event_row.sort_at DESC, event_row.event_title) AS event_titles,
        jsonb_agg(
          jsonb_build_object(
            'event_id', event_row.event_id,
            'event_title', event_row.event_title
          )
          ORDER BY event_row.sort_at DESC, event_row.event_title
        ) AS events
      FROM (
        SELECT DISTINCT
          me.event_id,
          e.title AS event_title,
          COALESCE(me.created_at, e.created_at, m.created_at) AS sort_at
        FROM public.match_events me
        INNER JOIN public.events e
          ON e.id = me.event_id
        WHERE me.match_id = m.id
      ) event_row
    ) ordered_events
  ) event_bundle
    ON true;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_chat(
  p_match_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_chat_id UUID;
  v_match RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id
    AND v_user_id IN (m.user1_id, m.user2_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found or permission denied';
  END IF;

  SELECT c.id
  INTO v_chat_id
  FROM public.chats c
  WHERE c.match_id = p_match_id
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (match_id, created_at, closed_at)
    VALUES (p_match_id, timezone('utc'::text, now()), NULL)
    RETURNING id
    INTO v_chat_id;
  ELSE
    UPDATE public.chats
    SET closed_at = NULL
    WHERE id = v_chat_id;
  END IF;

  INSERT INTO public.chat_participants (chat_id, user_id)
  VALUES (v_chat_id, v_match.user1_id), (v_chat_id, v_match.user2_id)
  ON CONFLICT (chat_id, user_id) DO UPDATE
  SET deleted_at = NULL;

  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_match_seen(
  p_match_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET
    match_seen = true,
    last_interaction_at = GREATEST(COALESCE(last_interaction_at, timezone('utc'::text, now())), timezone('utc'::text, now()))
  WHERE id = p_match_id
    AND auth.uid() IN (user1_id, user2_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_opened(
  p_match_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET
    chat_opened = true,
    last_interaction_at = GREATEST(COALESCE(last_interaction_at, timezone('utc'::text, now())), timezone('utc'::text, now()))
  WHERE id = p_match_id
    AND auth.uid() IN (user1_id, user2_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmatch_user(
  p_match_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match RECORD;
  v_partner_id UUID;
  v_chat_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id
    AND v_user_id IN (m.user1_id, m.user2_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found or permission denied';
  END IF;

  v_partner_id := CASE
    WHEN v_match.user1_id = v_user_id THEN v_match.user2_id
    ELSE v_match.user1_id
  END;

  SELECT id
  INTO v_chat_id
  FROM public.chats
  WHERE match_id = p_match_id
  LIMIT 1;

  UPDATE public.matches
  SET
    status = 'inactive',
    unmatched_by = v_user_id,
    unmatched_at = timezone('utc'::text, now()),
    last_interaction_at = timezone('utc'::text, now())
  WHERE id = p_match_id;

  IF v_chat_id IS NOT NULL THEN
    UPDATE public.chats
    SET closed_at = timezone('utc'::text, now())
    WHERE id = v_chat_id;
  END IF;

  DELETE FROM public.likes l
  WHERE (
      l.from_user_id = v_match.user1_id
      AND l.to_user_id = v_match.user2_id
    ) OR (
      l.from_user_id = v_match.user2_id
      AND l.to_user_id = v_match.user1_id
    );

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    v_partner_id,
    'system',
    'Match desfeito',
    'O match foi desfeito. A conversa foi encerrada.'
  );
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = v_user_id
      AND COALESCE(ep.status, 'confirmed') <> 'canceled'
  ) THEN
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

  SELECT *
  INTO v_match_result
  FROM public.handle_match(v_from_user_id, p_to_user_id, p_event_id);

  IF v_match_result.is_new_match OR v_match_result.match_reactivated THEN
    INSERT INTO public.notifications (user_id, type, event_id, payload)
    VALUES
      (
        v_from_user_id,
        'match',
        p_event_id,
        jsonb_build_object(
          'match_id', v_match_result.match_id,
          'chat_id', v_match_result.chat_id,
          'event_name', v_event_title,
          'partner_id', p_to_user_id
        )
      ),
      (
        p_to_user_id,
        'match',
        p_event_id,
        jsonb_build_object(
          'match_id', v_match_result.match_id,
          'chat_id', v_match_result.chat_id,
          'event_name', v_event_title,
          'partner_id', v_from_user_id
        )
      );
  END IF;

  RETURN jsonb_build_object(
    'status', 'match',
    'like_id', v_like_id,
    'match_id', v_match_result.match_id,
    'chat_id', v_match_result.chat_id,
    'is_new_match', v_match_result.is_new_match,
    'match_reactivated', v_match_result.match_reactivated,
    'event_link_created', v_match_result.event_link_created
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_match_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_match_id UUID;
BEGIN
  SELECT c.match_id
  INTO v_match_id
  FROM public.chats c
  WHERE c.id = NEW.chat_id;

  IF v_match_id IS NOT NULL THEN
    UPDATE public.matches
    SET last_interaction_at = GREATEST(COALESCE(last_interaction_at, NEW.created_at), NEW.created_at)
    WHERE id = v_match_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_message_activity ON public.messages;
CREATE TRIGGER on_match_message_activity
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_message_activity();

GRANT EXECUTE ON FUNCTION public.handle_match(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_matches() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_event_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_match_seen(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_chat_opened(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmatch_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_profile_complete_for_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_match_candidates_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_received_likes_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.like_user(UUID, UUID) TO authenticated;
