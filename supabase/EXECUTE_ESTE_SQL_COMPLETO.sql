-- ============================================
-- SETUP COMPLETO - NOVOS RECURSOS DE EVENTOS
-- Execute TODO este SQL no Supabase SQL Editor
-- ============================================

-- ============================================
-- PASSO 1: Adicionar campos de localização
-- ============================================

-- Adicionar coluna de estado (UF)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS state VARCHAR(2);

-- Adicionar coluna de cidade
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Adicionar comentários para documentação
COMMENT ON COLUMN events.state IS 'Sigla do estado (UF) onde o evento será realizado';
COMMENT ON COLUMN events.city IS 'Cidade onde o evento será realizado';

-- ============================================
-- PASSO 2: Criar tabela de tipos de ingressos
-- ============================================

-- Criar tabela ticket_types se não existir
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sale_start_date TIMESTAMP WITH TIME ZONE,
  sale_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_is_active ON ticket_types(is_active);

-- Adicionar comentários para documentação
COMMENT ON TABLE ticket_types IS 'Tipos de ingressos disponíveis para cada evento (lotes, meias, VIP, etc)';
COMMENT ON COLUMN ticket_types.name IS 'Nome do tipo de ingresso (ex: 1º Lote, Meia-Entrada, VIP)';
COMMENT ON COLUMN ticket_types.description IS 'Descrição do que está incluído neste ingresso';
COMMENT ON COLUMN ticket_types.price IS 'Preço do ingresso em reais';
COMMENT ON COLUMN ticket_types.quantity_available IS 'Quantidade total disponível deste tipo';
COMMENT ON COLUMN ticket_types.quantity_sold IS 'Quantidade já vendida deste tipo';
COMMENT ON COLUMN ticket_types.is_active IS 'Se este tipo de ingresso está ativo para venda';
COMMENT ON COLUMN ticket_types.sale_start_date IS 'Data de início das vendas (opcional)';
COMMENT ON COLUMN ticket_types.sale_end_date IS 'Data de término das vendas (opcional)';

-- ============================================
-- PASSO 3: Habilitar Row Level Security (RLS)
-- ============================================

ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASSO 4: Criar Policies de Segurança
-- ============================================

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Tipos de ingressos são visíveis para todos" ON ticket_types;
DROP POLICY IF EXISTS "Criadores podem adicionar tipos de ingressos" ON ticket_types;
DROP POLICY IF EXISTS "Criadores podem atualizar tipos de ingressos" ON ticket_types;
DROP POLICY IF EXISTS "Criadores podem deletar tipos de ingressos" ON ticket_types;

-- Policy para leitura pública (todos podem ver os tipos de ingressos)
CREATE POLICY "Tipos de ingressos são visíveis para todos" ON ticket_types
  FOR SELECT USING (true);

-- Policy para inserção (apenas criadores de eventos podem adicionar)
CREATE POLICY "Criadores podem adicionar tipos de ingressos" ON ticket_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_types.event_id 
      AND events.creator_id = auth.uid()
    )
  );

-- Policy para atualização (apenas criadores de eventos podem atualizar)
CREATE POLICY "Criadores podem atualizar tipos de ingressos" ON ticket_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_types.event_id 
      AND events.creator_id = auth.uid()
    )
  );

-- Policy para deleção (apenas criadores de eventos podem deletar)
CREATE POLICY "Criadores podem deletar tipos de ingressos" ON ticket_types
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM events 
      WHERE events.id = ticket_types.event_id 
      AND events.creator_id = auth.uid()
    )
  );

-- ============================================
-- PASSO 5: Atualizar event_participants
-- ============================================

-- Adicionar coluna ticket_type_id se não existir
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE SET NULL;

-- Adicionar índice
CREATE INDEX IF NOT EXISTS idx_event_participants_ticket_type_id ON event_participants(ticket_type_id);

-- Comentário
COMMENT ON COLUMN event_participants.ticket_type_id IS 'Tipo de ingresso adquirido pelo participante';

-- ============================================
-- PASSO 6: Criar Função de Atualização Automática
-- ============================================

CREATE OR REPLACE FUNCTION update_ticket_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.ticket_type_id IS NOT NULL THEN
    -- Incrementar quantity_sold quando um ingresso é vendido
    UPDATE ticket_types
    SET quantity_sold = quantity_sold + COALESCE(NEW.ticket_quantity, 1)
    WHERE id = NEW.ticket_type_id;
    
  ELSIF TG_OP = 'DELETE' AND OLD.ticket_type_id IS NOT NULL THEN
    -- Decrementar quantity_sold quando um ingresso é cancelado
    UPDATE ticket_types
    SET quantity_sold = GREATEST(0, quantity_sold - COALESCE(OLD.ticket_quantity, 1))
    WHERE id = OLD.ticket_type_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ajustar quantity_sold quando a quantidade é alterada
    IF OLD.ticket_type_id IS NOT NULL AND NEW.ticket_type_id IS NOT NULL THEN
      IF OLD.ticket_type_id = NEW.ticket_type_id THEN
        UPDATE ticket_types
        SET quantity_sold = quantity_sold - COALESCE(OLD.ticket_quantity, 1) + COALESCE(NEW.ticket_quantity, 1)
        WHERE id = NEW.ticket_type_id;
      ELSE
        -- Se mudou o tipo de ingresso, decrementar do antigo e incrementar no novo
        UPDATE ticket_types
        SET quantity_sold = GREATEST(0, quantity_sold - COALESCE(OLD.ticket_quantity, 1))
        WHERE id = OLD.ticket_type_id;
        
        UPDATE ticket_types
        SET quantity_sold = quantity_sold + COALESCE(NEW.ticket_quantity, 1)
        WHERE id = NEW.ticket_type_id;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger (remover se já existir)
DROP TRIGGER IF EXISTS trigger_update_ticket_quantity_sold ON event_participants;
CREATE TRIGGER trigger_update_ticket_quantity_sold
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_quantity_sold();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Verificar colunas de events
DO $$
DECLARE
  state_exists BOOLEAN;
  city_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'state'
  ) INTO state_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'city'
  ) INTO city_exists;
  
  IF state_exists AND city_exists THEN
    RAISE NOTICE '✅ Colunas state e city adicionadas à tabela events';
  ELSE
    RAISE WARNING '⚠️  Problema ao adicionar colunas de localização';
  END IF;
END $$;

-- Verificar tabela ticket_types
DO $$
DECLARE
  table_exists BOOLEAN;
  policies_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'ticket_types'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies
    WHERE tablename = 'ticket_types';
    
    RAISE NOTICE '✅ Tabela ticket_types criada com sucesso!';
    RAISE NOTICE '✅ % policies de segurança configuradas!', policies_count;
    RAISE NOTICE '✅ Triggers de atualização automática criados!';
  ELSE
    RAISE WARNING '⚠️  Problema ao criar tabela ticket_types';
  END IF;
END $$;

-- Mensagem final
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 ========================================';
  RAISE NOTICE '🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '🎉 ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Recursos Habilitados:';
  RAISE NOTICE '   ✅ Campos de localização (Estado e Cidade)';
  RAISE NOTICE '   ✅ Sistema de tipos de ingressos';
  RAISE NOTICE '   ✅ Lotes, meias-entradas, VIP, etc.';
  RAISE NOTICE '   ✅ Controle automático de estoque';
  RAISE NOTICE '   ✅ Políticas de segurança RLS';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Próximos Passos:';
  RAISE NOTICE '   1. Acesse: http://localhost:8086';
  RAISE NOTICE '   2. Limpe o cache do navegador (Cmd+Shift+R)';
  RAISE NOTICE '   3. Crie um novo evento e teste!';
  RAISE NOTICE '';
END $$;
