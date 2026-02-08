-- Migration to add ticket validation system

-- 1. Add columns to event_participants
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS security_token UUID DEFAULT gen_random_uuid();

-- 2. Create check_in_logs table
CREATE TABLE IF NOT EXISTS check_in_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES event_participants(id) NOT NULL,
  event_id UUID REFERENCES events(id) NOT NULL,
  validated_by UUID REFERENCES auth.users(id) NOT NULL,
  check_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  device_info TEXT
);

-- 3. Create indexes for logs
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event_id ON check_in_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_ticket_id ON check_in_logs(ticket_id);

-- 4. RPC Function to validate ticket
CREATE OR REPLACE FUNCTION validate_ticket(
  p_ticket_id UUID,
  p_event_id UUID,
  p_security_token UUID,
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

  -- 2. Verify permission (optional: check if p_validated_by is organizer or staff)
  -- For now, we assume the API caller checks RLS or we trust the authenticated user context if called via client
  -- Ideally, check if p_validated_by is the creator of the event
  SELECT (creator_id = p_validated_by) INTO v_is_organizer
  FROM events WHERE id = p_event_id;
  
  -- Allow if organizer OR if we implement a staff system later. 
  -- For now, enforce organizer only to be safe, or just log it.
  -- User requirement: "Acessível apenas para: Organizadores, Staff autorizado"
  -- We will check if the user is the organizer.
  IF NOT v_is_organizer THEN
     -- Check if user is admin (optional, assuming 'admin' role exists in profiles or claims)
     -- For this MVP, we strictly require the user to be the organizer.
     RETURN jsonb_build_object('success', false, 'message', 'Usuário não autorizado a validar ingressos deste evento', 'code', 'UNAUTHORIZED');
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
  
  IF v_participant.security_token != p_security_token THEN
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
    check_in_at = NOW()
  WHERE id = p_ticket_id;

  -- 6. Log Check-in
  INSERT INTO check_in_logs (ticket_id, event_id, validated_by, check_in_at)
  VALUES (p_ticket_id, p_event_id, p_validated_by, NOW());

  -- 7. Return Success
  -- Fetch user name for display
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Ingresso validado com sucesso', 
    'participant_id', v_participant.user_id,
    'ticket_type_id', v_participant.ticket_type_id
  );
END;
$$;
