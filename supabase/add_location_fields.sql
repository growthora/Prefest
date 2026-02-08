-- Adicionar campos de estado e cidade na tabela de eventos
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna de estado (UF)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS state VARCHAR(2);

-- Adicionar coluna de cidade
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Adicionar comentários para documentação
COMMENT ON COLUMN events.state IS 'Sigla do estado (UF) onde o evento será realizado';
COMMENT ON COLUMN events.city IS 'Cidade onde o evento será realizado';

-- Atualizar eventos existentes com valores padrão (opcional)
-- Descomente as linhas abaixo se quiser atualizar eventos existentes
-- UPDATE events 
-- SET state = 'SP', city = 'São Paulo' 
-- WHERE state IS NULL OR city IS NULL;
