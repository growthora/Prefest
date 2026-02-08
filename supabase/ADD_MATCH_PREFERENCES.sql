-- ============================================
-- ADICIONAR PREFERÊNCIAS DE MATCH
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- Adicionar campos de preferências de match na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS match_intention TEXT DEFAULT 'paquera' CHECK (match_intention IN ('paquera', 'amizade')),
ADD COLUMN IF NOT EXISTS match_gender_preference TEXT DEFAULT 'todos' CHECK (match_gender_preference IN ('homens', 'mulheres', 'todos'));

-- Comentários para documentação
COMMENT ON COLUMN profiles.match_intention IS 'Intenção do usuário: paquera ou amizade';
COMMENT ON COLUMN profiles.match_gender_preference IS 'Preferência de gênero para matches: homens, mulheres ou todos';

-- Atualizar registros existentes com valores padrão
UPDATE profiles 
SET 
  match_intention = 'paquera',
  match_gender_preference = 'todos'
WHERE match_intention IS NULL OR match_gender_preference IS NULL;
