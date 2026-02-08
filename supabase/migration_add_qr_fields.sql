-- ============================================
-- MIGRAÇÃO: Adicionar campos de QR Code
-- ============================================
-- Execute este arquivo no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- 1. Adicionar coluna ticket_token (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_participants' AND column_name = 'ticket_token'
  ) THEN
    ALTER TABLE event_participants 
    ADD COLUMN ticket_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL;
  END IF;
END $$;

-- 2. Adicionar coluna qr_code_data (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_participants' AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE event_participants 
    ADD COLUMN qr_code_data TEXT;
  END IF;
END $$;

-- 3. Adicionar coluna status (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_participants' AND column_name = 'status'
  ) THEN
    ALTER TABLE event_participants 
    ADD COLUMN status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'canceled'));
  END IF;
END $$;

-- 4. Adicionar coluna used_at (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_participants' AND column_name = 'used_at'
  ) THEN
    ALTER TABLE event_participants 
    ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 5. Adicionar coluna validated_by (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_participants' AND column_name = 'validated_by'
  ) THEN
    ALTER TABLE event_participants 
    ADD COLUMN validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Atualizar role do enum profiles para incluir 'equipe'
DO $$ 
BEGIN
  -- Verificar se 'equipe' já existe no tipo
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'equipe' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    -- Adicionar 'equipe' ao enum existente
    ALTER TYPE user_role ADD VALUE 'equipe';
  END IF;
END $$;

-- 7. Gerar tokens para ingressos existentes sem token
UPDATE event_participants 
SET ticket_token = gen_random_uuid() 
WHERE ticket_token IS NULL;

-- 8. Criar ou substituir função de validação de ingresso
CREATE OR REPLACE FUNCTION validate_ticket(p_ticket_token UUID, p_validator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_participant RECORD;
  v_event RECORD;
  v_profile RECORD;
  v_result JSON;
BEGIN
  -- Buscar o participante pelo token
  SELECT * INTO v_participant
  FROM event_participants
  WHERE ticket_token = p_ticket_token;

  -- Se não encontrou o ingresso
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso não encontrado',
      'status', 'invalid'
    );
  END IF;

  -- Verificar se já foi utilizado
  IF v_participant.status = 'used' THEN
    -- Buscar informações do evento e participante
    SELECT * INTO v_event FROM events WHERE id = v_participant.event_id;
    SELECT * INTO v_profile FROM profiles WHERE id = v_participant.user_id;
    
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso já foi utilizado',
      'status', 'used',
      'event_title', v_event.title,
      'event_date', v_event.event_date,
      'participant_name', v_profile.full_name,
      'used_at', v_participant.used_at
    );
  END IF;

  -- Verificar se foi cancelado
  IF v_participant.status = 'canceled' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso cancelado',
      'status', 'canceled'
    );
  END IF;

  -- Marcar como utilizado
  UPDATE event_participants
  SET 
    status = 'used',
    used_at = NOW(),
    validated_by = p_validator_id
  WHERE ticket_token = p_ticket_token;

  -- Buscar informações para retorno
  SELECT * INTO v_event FROM events WHERE id = v_participant.event_id;
  SELECT * INTO v_profile FROM profiles WHERE id = v_participant.user_id;

  -- Retornar sucesso
  RETURN json_build_object(
    'success', true,
    'message', 'Ingresso validado com sucesso',
    'status', 'valid',
    'event_title', v_event.title,
    'event_date', v_event.event_date,
    'participant_name', v_profile.full_name,
    'validated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Adicionar política RLS para equipe validar ingressos
DROP POLICY IF EXISTS "Equipe pode validar ingressos" ON event_participants;

CREATE POLICY "Equipe pode validar ingressos" ON event_participants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'equipe')
    )
  );

-- 10. Verificar estrutura final
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'event_participants'
ORDER BY ordinal_position;

-- ============================================
-- MIGRAÇÃO CONCLUÍDA
-- ============================================
-- Verifique se todas as colunas foram criadas corretamente
-- e se a função validate_ticket() foi criada com sucesso
