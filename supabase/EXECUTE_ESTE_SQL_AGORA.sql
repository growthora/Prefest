-- ============================================
-- MIGRAÇÃO RÁPIDA: Adicionar campos de QR Code
-- ============================================
-- Copie e cole este código no SQL Editor do Supabase
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- Adicionar colunas necessárias
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS ticket_token UUID DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS qr_code_data TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Adicionar constraint de status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_participants_status_check'
  ) THEN
    ALTER TABLE event_participants 
    ADD CONSTRAINT event_participants_status_check 
    CHECK (status IN ('valid', 'used', 'canceled'));
  END IF;
END $$;

-- Gerar tokens para registros existentes
UPDATE event_participants 
SET ticket_token = gen_random_uuid() 
WHERE ticket_token IS NULL;

-- Tornar ticket_token NOT NULL após gerar os valores
ALTER TABLE event_participants 
ALTER COLUMN ticket_token SET NOT NULL;

-- ============================================
-- FUNÇÃO DE VALIDAÇÃO DE INGRESSO
-- ============================================

CREATE OR REPLACE FUNCTION validate_ticket(p_ticket_token UUID, p_validator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_participant RECORD;
  v_event RECORD;
  v_profile RECORD;
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

-- ============================================
-- POLÍTICA RLS PARA EQUIPE
-- ============================================

DROP POLICY IF EXISTS "Equipe pode validar ingressos" ON event_participants;

CREATE POLICY "Equipe pode validar ingressos" ON event_participants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'equipe')
    )
  );

-- ============================================
-- ADICIONAR ROLE EQUIPE
-- ============================================

-- Verificar se o tipo user_role existe, se não, criar
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'equipe');
  ELSE
    -- Se existe, adicionar 'equipe' se ainda não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum 
      WHERE enumlabel = 'equipe' 
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
      ALTER TYPE user_role ADD VALUE 'equipe';
    END IF;
  END IF;
END $$;
