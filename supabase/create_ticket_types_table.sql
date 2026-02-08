-- ============================================
-- CRIAR TABELA DE TIPOS DE INGRESSOS
-- Execute este SQL no Supabase SQL Editor
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
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES PARA ticket_types
-- ============================================

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
-- ATUALIZAR event_participants PARA REFERENCIAR ticket_types
-- ============================================

-- Adicionar coluna ticket_type_id se não existir
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE SET NULL;

-- Adicionar índice
CREATE INDEX IF NOT EXISTS idx_event_participants_ticket_type_id ON event_participants(ticket_type_id);

-- Comentário
COMMENT ON COLUMN event_participants.ticket_type_id IS 'Tipo de ingresso adquirido pelo participante';

-- ============================================
-- FUNÇÃO PARA ATUALIZAR quantity_sold AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION update_ticket_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Incrementar quantity_sold quando um ingresso é vendido
    UPDATE ticket_types
    SET quantity_sold = quantity_sold + NEW.ticket_quantity
    WHERE id = NEW.ticket_type_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrementar quantity_sold quando um ingresso é cancelado
    UPDATE ticket_types
    SET quantity_sold = quantity_sold - OLD.ticket_quantity
    WHERE id = OLD.ticket_type_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Ajustar quantity_sold quando a quantidade é alterada
    IF OLD.ticket_type_id = NEW.ticket_type_id THEN
      UPDATE ticket_types
      SET quantity_sold = quantity_sold - OLD.ticket_quantity + NEW.ticket_quantity
      WHERE id = NEW.ticket_type_id;
    ELSE
      -- Se mudou o tipo de ingresso, decrementar do antigo e incrementar no novo
      UPDATE ticket_types
      SET quantity_sold = quantity_sold - OLD.ticket_quantity
      WHERE id = OLD.ticket_type_id;
      
      UPDATE ticket_types
      SET quantity_sold = quantity_sold + NEW.ticket_quantity
      WHERE id = NEW.ticket_type_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_update_ticket_quantity_sold ON event_participants;
CREATE TRIGGER trigger_update_ticket_quantity_sold
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_quantity_sold();

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Verificar se a tabela foi criada corretamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'ticket_types'
ORDER BY ordinal_position;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Tabela ticket_types criada com sucesso!';
  RAISE NOTICE '✅ Policies de segurança configuradas!';
  RAISE NOTICE '✅ Triggers de atualização automática criados!';
  RAISE NOTICE '🎫 Sistema de tipos de ingressos pronto para uso!';
END $$;
