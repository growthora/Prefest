-- EXECUTE ESTE SQL COMPLETO NO SUPABASE
-- Ele vai deletar e recriar tudo corretamente

-- 1. Deletar tabela e tudo relacionado
DROP TABLE IF EXISTS event_requests CASCADE;

-- 2. Criar tabela para solicitações de eventos
CREATE TABLE event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  city VARCHAR(100) NOT NULL,
  event_location VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'contacted')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para melhor performance
CREATE INDEX idx_event_requests_status ON event_requests(status);
CREATE INDEX idx_event_requests_created_at ON event_requests(created_at DESC);
CREATE INDEX idx_event_requests_email ON event_requests(email);

-- 4. DESABILITAR RLS para permitir inserção de qualquer usuário
ALTER TABLE event_requests DISABLE ROW LEVEL SECURITY;

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_event_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_event_requests_updated_at
  BEFORE UPDATE ON event_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_event_requests_updated_at();

-- 10. Comentários
COMMENT ON TABLE event_requests IS 'Solicitações de criação de eventos enviadas por usuários';
COMMENT ON COLUMN event_requests.status IS 'Status da solicitação: pending, approved, rejected, contacted';
