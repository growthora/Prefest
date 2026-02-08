-- ============================================
-- ADICIONAR COLUNA DE SEXUALIDADE
-- ============================================
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna sexuality na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS sexuality TEXT DEFAULT 'heterossexual';

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.profiles.sexuality IS 'Sexualidade do usuário: heterossexual, homossexual, bissexual, pansexual, outro';
