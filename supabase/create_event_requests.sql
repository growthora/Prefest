-- Criar tabela para solicitações de eventos
CREATE TABLE IF NOT EXISTS event_requests (
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

-- Criar índices para melhor performance
CREATE INDEX idx_event_requests_status ON event_requests(status);
CREATE INDEX idx_event_requests_created_at ON event_requests(created_at DESC);
CREATE INDEX idx_event_requests_email ON event_requests(email);

-- RLS Policies
ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode criar uma solicitação (autenticada ou não)
CREATE POLICY "Anyone can create event requests"
  ON event_requests
  FOR INSERT
  WITH CHECK (true);

-- Também permitir para anon explicitamente
CREATE POLICY "Anon can create event requests"
  ON event_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Apenas admins podem ver todas as solicitações
CREATE POLICY "Admins can view all event requests"
  ON event_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Apenas admins podem atualizar solicitações
CREATE POLICY "Admins can update event requests"
  ON event_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger para atualizar updated_at
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

-- Comentários
COMMENT ON TABLE event_requests IS 'Solicitações de criação de eventos enviadas por usuários';
COMMENT ON COLUMN event_requests.status IS 'Status da solicitação: pending, approved, rejected, contacted';
