-- ============================================
-- CRIAR TABELA DE MENSAGENS DO CHAT
-- ============================================
-- Execute este SQL no Supabase SQL Editor

-- Criar tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.user_likes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_match ON public.chat_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON public.chat_messages(read) WHERE read = false;

-- Habilitar RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can view messages from their matches" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their matches" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin can view all messages" ON public.chat_messages;

-- Política: Usuários podem ver mensagens de seus matches
CREATE POLICY "Users can view messages from their matches"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE user_likes.id = chat_messages.match_id
    AND (user_likes.from_user_id = auth.uid() OR user_likes.to_user_id = auth.uid())
    AND user_likes.is_match = true
  )
);

-- Política: Usuários podem enviar mensagens para seus matches
CREATE POLICY "Users can send messages to their matches"
ON public.chat_messages FOR INSERT
WITH CHECK (
  (sender_id = auth.uid() OR sender_id IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE user_likes.id = chat_messages.match_id
    AND (user_likes.from_user_id = auth.uid() OR user_likes.to_user_id = auth.uid())
    AND user_likes.is_match = true
  )
);

-- Trigger para preencher sender_id automaticamente
CREATE OR REPLACE FUNCTION public.set_message_sender()
RETURNS TRIGGER AS $$
BEGIN
  -- Se sender_id não foi fornecido, usar o usuário autenticado
  IF NEW.sender_id IS NULL THEN
    NEW.sender_id := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_message_sender_trigger ON public.chat_messages;
CREATE TRIGGER set_message_sender_trigger
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_sender();

-- Política: Usuários podem marcar mensagens como lidas (apenas mensagens recebidas)
CREATE POLICY "Users can update their own messages"
ON public.chat_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE user_likes.id = chat_messages.match_id
    AND (user_likes.from_user_id = auth.uid() OR user_likes.to_user_id = auth.uid())
    AND user_likes.is_match = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE user_likes.id = chat_messages.match_id
    AND (user_likes.from_user_id = auth.uid() OR user_likes.to_user_id = auth.uid())
    AND user_likes.is_match = true
  )
);

-- Política: Admins podem ver todas as mensagens
CREATE POLICY "Admin can view all messages"
ON public.chat_messages FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Habilitar Realtime para a tabela (verificar se já não está habilitado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

-- Comentário explicativo
COMMENT ON TABLE public.chat_messages IS 'Mensagens do chat entre usuários que deram match';
COMMENT ON COLUMN public.chat_messages.match_id IS 'ID do match (referência à tabela user_likes onde is_match=true)';
COMMENT ON COLUMN public.chat_messages.sender_id IS 'ID do usuário que enviou a mensagem';
COMMENT ON COLUMN public.chat_messages.message IS 'Conteúdo da mensagem';
COMMENT ON COLUMN public.chat_messages.read IS 'Se a mensagem foi lida pelo destinatário';
