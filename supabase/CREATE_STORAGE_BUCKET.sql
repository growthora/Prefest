-- ============================================
-- CRIAR BUCKET PARA IMAGENS
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- Criar bucket público para imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload any images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update any images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete any images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile images" ON storage.objects;

-- Política: Qualquer pessoa pode ver as imagens
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Política: Admins podem fazer upload de qualquer imagem
CREATE POLICY "Admin can upload any images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Política: Usuários podem fazer upload de suas próprias fotos de perfil
CREATE POLICY "Users can upload profile images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images'
  AND name LIKE 'profiles/%'
  AND auth.uid() IS NOT NULL
);

-- Política: Admins podem atualizar qualquer imagem
CREATE POLICY "Admin can update any images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Política: Usuários podem atualizar suas próprias fotos de perfil
CREATE POLICY "Users can update profile images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images'
  AND name LIKE 'profiles/%'
  AND auth.uid() IS NOT NULL
);

-- Política: Admins podem deletar qualquer imagem
CREATE POLICY "Admin can delete any images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Política: Usuários podem deletar suas próprias fotos de perfil
CREATE POLICY "Users can delete profile images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images'
  AND name LIKE 'profiles/%'
  AND auth.uid() IS NOT NULL
);
