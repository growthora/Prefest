-- ============================================
-- LIMPEZA AUTOMÁTICA DE MENSAGENS ANTIGAS
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Mensagens com mais de 10 dias serão deletadas automaticamente

-- Função para deletar mensagens antigas (mais de 10 dias)
CREATE OR REPLACE FUNCTION public.delete_old_chat_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE created_at < NOW() - INTERVAL '10 days';
  
  RAISE NOTICE 'Mensagens antigas deletadas com sucesso';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar extensão pg_cron se ainda não existir (necessária para agendamento)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar a limpeza para rodar todo dia à meia-noite
-- Remove qualquer job anterior com o mesmo nome (se existir)
DO $$
BEGIN
  PERFORM cron.unschedule('delete-old-chat-messages');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignora erro se job não existir
END $$;

-- Criar o job que roda diariamente à 00:00 (meia-noite)
SELECT cron.schedule(
  'delete-old-chat-messages',           -- Nome do job
  '0 0 * * *',                          -- Cron schedule: todo dia à meia-noite
  $$SELECT public.delete_old_chat_messages()$$
);

-- Comentário explicativo
COMMENT ON FUNCTION public.delete_old_chat_messages() IS 'Deleta mensagens de chat com mais de 10 dias automaticamente';

-- Para executar manualmente (teste):
-- SELECT public.delete_old_chat_messages();

-- Para ver os jobs agendados:
-- SELECT * FROM cron.job;

-- Para desagendar (se necessário):
-- SELECT cron.unschedule('delete-old-chat-messages');
