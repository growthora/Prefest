-- Adicionar colunas de modo solteiro e anonimato aos perfis existentes
-- Execute este script no SQL Editor do Supabase

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS single_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_initials_only BOOLEAN DEFAULT false;

-- Atualizar perfis existentes com valores padrão
UPDATE profiles 
SET 
  single_mode = COALESCE(single_mode, false),
  show_initials_only = COALESCE(show_initials_only, false)
WHERE single_mode IS NULL OR show_initials_only IS NULL;
