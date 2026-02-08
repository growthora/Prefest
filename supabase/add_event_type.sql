-- Adicionar campo event_type na tabela events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'festive' 
CHECK (event_type IN ('festive', 'formal'));

-- Comentário
COMMENT ON COLUMN events.event_type IS 'Tipo do evento: festive (match para amizade/paquera) ou formal (networking profissional)';

-- Criar índice para melhor performance em filtros
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
