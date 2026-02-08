-- Criar tabela de tipos de ingressos
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Ex: "Lote 1", "Meia Entrada", "VIP"
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  quantity_available INTEGER NOT NULL,
  quantity_sold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sale_start_date TIMESTAMP WITH TIME ZONE,
  sale_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_quantity CHECK (quantity_sold <= quantity_available),
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_dates CHECK (sale_start_date IS NULL OR sale_end_date IS NULL OR sale_start_date < sale_end_date)
);

-- Índices para performance
CREATE INDEX idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX idx_ticket_types_is_active ON ticket_types(is_active);

-- Atualizar tabela event_participants para referenciar tipo de ingresso
ALTER TABLE event_participants 
ADD COLUMN IF NOT EXISTS ticket_type_id UUID REFERENCES ticket_types(id);

-- RLS Policies
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa autenticada pode ver tipos de ingressos ativos
CREATE POLICY "Anyone can view active ticket types"
  ON ticket_types FOR SELECT
  USING (is_active = true);

-- Apenas criadores do evento podem criar/editar tipos de ingressos
CREATE POLICY "Event creators can manage ticket types"
  ON ticket_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = ticket_types.event_id
      AND events.creator_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_ticket_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_types_updated_at
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_types_updated_at();

-- Trigger para atualizar quantity_sold quando um ingresso é comprado
CREATE OR REPLACE FUNCTION update_ticket_type_quantity_sold()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ticket_types 
    SET quantity_sold = quantity_sold + NEW.ticket_quantity
    WHERE id = NEW.ticket_type_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ticket_types 
    SET quantity_sold = quantity_sold - OLD.ticket_quantity
    WHERE id = OLD.ticket_type_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_participants_update_ticket_sold
  AFTER INSERT OR DELETE ON event_participants
  FOR EACH ROW
  WHEN (NEW.ticket_type_id IS NOT NULL OR OLD.ticket_type_id IS NOT NULL)
  EXECUTE FUNCTION update_ticket_type_quantity_sold();

COMMENT ON TABLE ticket_types IS 'Tipos de ingressos disponíveis para cada evento (lotes, meias, VIP, etc)';
COMMENT ON COLUMN ticket_types.name IS 'Nome do tipo de ingresso (ex: Lote 1, Meia Entrada, VIP)';
COMMENT ON COLUMN ticket_types.quantity_available IS 'Quantidade total disponível deste tipo';
COMMENT ON COLUMN ticket_types.quantity_sold IS 'Quantidade já vendida/reservada';
