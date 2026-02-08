-- ============================================
-- CRIAR TABELA DE LIKES E MATCHES
-- ============================================
-- Execute este SQL no Supabase SQL Editor

-- Criar tabela de likes
CREATE TABLE IF NOT EXISTS public.user_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_match BOOLEAN DEFAULT FALSE,
  
  -- Garantir que um usuário não pode dar like duas vezes na mesma pessoa no mesmo evento
  UNIQUE(from_user_id, to_user_id, event_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_likes_from_user ON public.user_likes(from_user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_to_user ON public.user_likes(to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_event ON public.user_likes(event_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_match ON public.user_likes(is_match);

-- Habilitar RLS
ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Users can view likes they received" ON public.user_likes;
DROP POLICY IF EXISTS "Users can view their own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can create likes" ON public.user_likes;
DROP POLICY IF EXISTS "Admin can view all likes" ON public.user_likes;
DROP POLICY IF EXISTS "Admin can delete likes" ON public.user_likes;

-- Política: Usuários podem ver likes que receberam
CREATE POLICY "Users can view likes they received"
ON public.user_likes FOR SELECT
USING (to_user_id = auth.uid());

-- Política: Usuários podem ver likes que deram
CREATE POLICY "Users can view their own likes"
ON public.user_likes FOR SELECT
USING (from_user_id = auth.uid());

-- Política: Usuários podem dar likes (o from_user_id será preenchido automaticamente)
CREATE POLICY "Users can create likes"
ON public.user_likes FOR INSERT
WITH CHECK (
  (from_user_id = auth.uid() OR from_user_id IS NULL)
  AND from_user_id != to_user_id -- Não pode dar like em si mesmo
);

-- Política: Admins podem ver todos os likes
CREATE POLICY "Admin can view all likes"
ON public.user_likes FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Política: Admins podem deletar likes
CREATE POLICY "Admin can delete likes"
ON public.user_likes FOR DELETE
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Trigger para preencher from_user_id automaticamente com o usuário autenticado
CREATE OR REPLACE FUNCTION public.set_like_from_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Se from_user_id não foi fornecido, usar o usuário autenticado
  IF NEW.from_user_id IS NULL THEN
    NEW.from_user_id := auth.uid();
  END IF;
  
  -- Validar que não está dando like em si mesmo
  IF NEW.from_user_id = NEW.to_user_id THEN
    RAISE EXCEPTION 'Não é possível dar like em si mesmo';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_like_from_user_trigger ON public.user_likes;
CREATE TRIGGER set_like_from_user_trigger
  BEFORE INSERT ON public.user_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_like_from_user();

-- Função para criar match quando dois usuários se curtem mutuamente
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se existe um like recíproco
  IF EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE from_user_id = NEW.to_user_id
    AND to_user_id = NEW.from_user_id
    AND event_id = NEW.event_id
  ) THEN
    -- Marcar ambos os likes como match
    UPDATE public.user_likes
    SET is_match = TRUE
    WHERE (
      (from_user_id = NEW.from_user_id AND to_user_id = NEW.to_user_id)
      OR (from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id)
    )
    AND event_id = NEW.event_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para verificar matches após inserir um like
DROP TRIGGER IF EXISTS check_match_after_like ON public.user_likes;
CREATE TRIGGER check_match_after_like
  AFTER INSERT ON public.user_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_create_match();
