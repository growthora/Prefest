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
  v_original_code TEXT := p_code;
  v_normalized_code TEXT;
BEGIN
  -- Normalize code (uppercase, remove ALL spaces)
  v_normalized_code := upper(regexp_replace(p_code, '\s+', '', 'g'));

  -- 1. Search for ticket by ticket_code
  SELECT * INTO v_participant
  FROM event_participants
  WHERE ticket_code = v_normalized_code;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso não encontrado', 
      'code', 'TICKET_NOT_FOUND',
      'debug', jsonb_build_object(
        'received', v_original_code,
        'normalized', v_normalized_code
      )
    );
  END IF;

  -- 2. Verify Event
  IF v_participant.event_id != p_event_id THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso pertence a outro evento', 
      'code', 'WRONG_EVENT',
      'debug', jsonb_build_object(
        'received', v_original_code,
        'normalized', v_normalized_code
      )
    );
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
      'participant_id', v_participant.user_id,
      'debug', jsonb_build_object(
        'received', v_original_code,
        'normalized', v_normalized_code
      )
    );
  END IF;

  IF v_participant.status != 'valid' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ingresso inválido ou cancelado', 
      'code', 'INVALID_STATUS',
      'debug', jsonb_build_object(
        'received', v_original_code,
        'normalized', v_normalized_code
      )
    );
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
    'ticket_code', v_participant.ticket_code,
    'debug', jsonb_build_object(
      'received', v_original_code,
      'normalized', v_normalized_code
    )
  );
END;
$$;
