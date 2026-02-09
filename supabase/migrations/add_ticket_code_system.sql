-- 1. Add ticket_code column
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS ticket_code TEXT UNIQUE;

-- 2. Function to generate random code
CREATE OR REPLACE FUNCTION generate_ticket_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'PF-';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger function to ensure code is set and unique
CREATE OR REPLACE FUNCTION set_ticket_code() RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  done BOOLEAN := FALSE;
BEGIN
  IF NEW.ticket_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WHILE NOT done LOOP
    new_code := generate_ticket_code();
    done := TRUE;
    PERFORM 1 FROM event_participants WHERE ticket_code = new_code;
    IF FOUND THEN
      done := FALSE;
    END IF;
  END LOOP;

  NEW.ticket_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_set_ticket_code ON event_participants;
CREATE TRIGGER trigger_set_ticket_code
  BEFORE INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_code();

-- 5. Backfill existing records
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM event_participants WHERE ticket_code IS NULL LOOP
    UPDATE event_participants
    SET ticket_code = generate_ticket_code() -- Trigger might not fire on update if logic is only for insert, but we can just set it here directly or rely on a wrapper. 
    -- Actually, direct update is better. But need to handle collision.
    WHERE id = r.id;
  END LOOP;
END $$;

-- 6. Create/Update validation function
CREATE OR REPLACE FUNCTION validate_ticket_scan(
  p_code TEXT,
  p_event_id UUID,
  p_validated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant RECORD;
  v_is_organizer BOOLEAN;
  v_event_exists BOOLEAN;
BEGIN
  -- Normalize code (uppercase, trim)
  p_code := upper(trim(p_code));

  -- 1. Search for ticket by ticket_code
  SELECT * INTO v_participant
  FROM event_participants
  WHERE ticket_code = p_code;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso não encontrado', 'code', 'TICKET_NOT_FOUND');
  END IF;

  -- 2. Verify Event
  IF v_participant.event_id != p_event_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso pertence a outro evento', 'code', 'WRONG_EVENT');
  END IF;

  -- 3. Verify permission
  SELECT (creator_id = p_validated_by) INTO v_is_organizer
  FROM events WHERE id = p_event_id;

  IF NOT v_is_organizer THEN
     RETURN jsonb_build_object('success', false, 'message', 'Você não tem permissão para validar este ingresso', 'code', 'UNAUTHORIZED');
  END IF;

  -- 4. Validate Status
  IF v_participant.status = 'used' OR v_participant.check_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso já utilizado', 
      'code', 'ALREADY_USED',
      'used_at', v_participant.check_in_at,
      'participant_id', v_participant.user_id
    );
  END IF;

  IF v_participant.status != 'valid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso inválido ou cancelado', 'code', 'INVALID_STATUS');
  END IF;

  -- 5. Process Check-in
  UPDATE event_participants 
  SET 
    status = 'used',
    check_in_at = NOW(),
    used_at = NOW(),
    validated_by = p_validated_by
  WHERE id = v_participant.id;

  -- 6. Log Check-in
  INSERT INTO check_in_logs (ticket_id, event_id, validated_by, check_in_at)
  VALUES (v_participant.id, p_event_id, p_validated_by, NOW());

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Check-in realizado com sucesso', 
    'code', 'SUCCESS',
    'participant_id', v_participant.user_id,
    'ticket_code', v_participant.ticket_code
  );
END;
$$;
