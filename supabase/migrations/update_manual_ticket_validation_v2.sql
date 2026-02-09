CREATE OR REPLACE FUNCTION validate_ticket_manual(
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
  v_count INTEGER;
  v_is_organizer BOOLEAN;
BEGIN
  -- 1. Search for ticket by partial ID (minimum 6 chars)
  IF length(p_code) < 6 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código deve ter pelo menos 6 caracteres', 'code', 'INVALID_CODE_LENGTH');
  END IF;

  SELECT count(*) INTO v_count
  FROM event_participants
  WHERE id::text ILIKE p_code || '%';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso não encontrado', 'code', 'TICKET_NOT_FOUND');
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código ambíguo (múltiplos ingressos encontrados)', 'code', 'AMBIGUOUS_CODE');
  END IF;

  -- 2. Fetch the unique ticket
  SELECT * INTO v_participant
  FROM event_participants
  WHERE id::text ILIKE p_code || '%'
  LIMIT 1;

  -- 3. Validate Event Ownership
  IF v_participant.event_id != p_event_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso não pertence ao evento selecionado', 'code', 'WRONG_EVENT');
  END IF;

  -- 4. Verify permission (Must be organizer of the event)
  SELECT (creator_id = p_validated_by) INTO v_is_organizer
  FROM events WHERE id = p_event_id;

  IF NOT v_is_organizer THEN
     RETURN jsonb_build_object('success', false, 'message', 'Você não tem permissão para validar este ingresso', 'code', 'UNAUTHORIZED');
  END IF;

  -- 5. Validate Status
  IF v_participant.status = 'used' OR v_participant.check_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso já utilizado', 
      'code', 'ALREADY_USED',
      'used_at', v_participant.check_in_at,
      'participant_id', v_participant.id
    );
  END IF;

  IF v_participant.status != 'valid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ingresso inválido ou cancelado', 'code', 'INVALID_STATUS');
  END IF;

  -- 6. Process Check-in
  UPDATE event_participants 
  SET 
    status = 'used',
    check_in_at = NOW()
  WHERE id = v_participant.id;

  -- 7. Log Check-in
  INSERT INTO check_in_logs (ticket_id, event_id, validated_by, check_in_at)
  VALUES (v_participant.id, p_event_id, p_validated_by, NOW());

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Check-in realizado com sucesso', 
    'code', 'SUCCESS',
    'participant_id', v_participant.id
  );
END;
$$;
