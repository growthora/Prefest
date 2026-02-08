-- Fix ticket validation schema
-- Drop redundant security_token if it exists (we will use ticket_token)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_participants' AND column_name = 'security_token') THEN
    ALTER TABLE event_participants DROP COLUMN security_token;
  END IF;
END $$;

-- Ensure ticket_token exists (it seemed to exist in the previous check, but just in case)
-- ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS ticket_token UUID DEFAULT gen_random_uuid();

-- Update validate_ticket RPC to use ticket_token
CREATE OR REPLACE FUNCTION validate_ticket(
  p_ticket_id UUID,
  p_event_id UUID,
  p_token UUID, -- changed from p_security_token
  p_validated_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant RECORD;
  v_event_exists BOOLEAN;
  v_is_organizer BOOLEAN;
BEGIN
  -- 1. Verify if event exists
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) INTO v_event_exists;
  IF NOT v_event_exists THEN
    RETURN jsonb_build_object('success', false, 'message', 'Evento não encontrado', 'code', 'EVENT_NOT_FOUND');
  END IF;

  -- 2. Verify permission
  SELECT (creator_id = p_validated_by) INTO v_is_organizer
  FROM events WHERE id = p_event_id;
  
  IF NOT v_is_organizer THEN
     RETURN jsonb_build_object('success', false, 'message', 'Usuário não autorizado', 'code', 'UNAUTHORIZED');
  END IF;

  -- 3. Fetch ticket details
  SELECT * INTO v_participant 
  FROM event_participants 
  WHERE id = p_ticket_id;

  -- 4. Validate Ticket
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso inexistente', 'code', 'TICKET_NOT_FOUND');
  END IF;

  IF v_participant.event_id != p_event_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso não pertence a este evento', 'code', 'WRONG_EVENT');
  END IF;
  
  -- Use ticket_token for validation
  IF v_participant.ticket_token IS DISTINCT FROM p_token THEN
     RETURN jsonb_build_object('success', false, 'message', 'Token de segurança inválido', 'code', 'INVALID_TOKEN');
  END IF;

  IF v_participant.status = 'used' OR v_participant.check_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso já utilizado', 
      'code', 'ALREADY_USED',
      'used_at', v_participant.check_in_at
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
    used_at = NOW(), -- Sync used_at
    validated_by = p_validated_by -- Update validated_by column
  WHERE id = p_ticket_id;

  -- 6. Log Check-in
  INSERT INTO check_in_logs (ticket_id, event_id, validated_by, check_in_at)
  VALUES (p_ticket_id, p_event_id, p_validated_by, NOW());

  -- 7. Return Success
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Ingresso validado com sucesso', 
    'participant_id', v_participant.user_id,
    'ticket_type_id', v_participant.ticket_type_id
  );
END;
$$;
