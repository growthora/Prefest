-- SOLUÇÃO DEFINITIVA - Execute isso no Supabase SQL Editor

-- 1. Deletar tudo
DROP TABLE IF EXISTS event_requests CASCADE;

-- 2. Recriar tabela
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

-- 3. Índices
CREATE INDEX idx_event_requests_status ON event_requests(status);
CREATE INDEX idx_event_requests_created_at ON event_requests(created_at DESC);
CREATE INDEX idx_event_requests_email ON event_requests(email);

-- 4. DESABILITAR RLS (permite acesso total - use com cuidado)
ALTER TABLE event_requests DISABLE ROW LEVEL SECURITY;

-- OU se quiser manter RLS, use isso:
-- ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;
-- 
-- -- Política super permissiva para INSERT
-- CREATE POLICY "enable_insert_for_all" ON event_requests
--   FOR INSERT TO public
--   WITH CHECK (true);
-- 
-- -- Política para SELECT apenas para admins
-- CREATE POLICY "enable_select_for_admins" ON event_requests
--   FOR SELECT TO authenticated
--   USING (
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
--   );
-- 
-- -- Política para UPDATE apenas para admins
-- CREATE POLICY "enable_update_for_admins" ON event_requests
--   FOR UPDATE TO authenticated
--   USING (
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
--   )
--   WITH CHECK (
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
--   );
--
-- -- Política para DELETE apenas para admins  
-- CREATE POLICY "enable_delete_for_admins" ON event_requests
--   FOR DELETE TO authenticated
--   USING (
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
--   );

-- 5. Trigger para updated_at
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

-- 6. Comentários
COMMENT ON TABLE event_requests IS 'Solicitações de criação de eventos enviadas por usuários';
COMMENT ON COLUMN event_requests.status IS 'Status da solicitação: pending, approved, rejected, contacted';
