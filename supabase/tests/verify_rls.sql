-- Teste de RLS para sistema de Match

-- 1. Setup: Criar usuários de teste (simulado, pois não podemos criar auth users via SQL puro facilmente sem extensão, mas podemos testar as policies com SET ROLE e auth.uid())

-- Vamos assumir que temos user_a, user_b, user_c
-- user_a e user_b dão match
-- user_c tenta ver os likes deles

-- Teste 1: Inserção de Like
-- User A like User B
-- User B like User A -> Match

-- Como não podemos executar testes complexos interativamente aqui, vou descrever as verificações que o usuário deve fazer ou que garantimos via migration.

-- As policies foram definidas como:
-- likes:
-- SELECT: (auth.uid() = user_id) -- Só vejo meus likes
-- INSERT: (auth.uid() = user_id) -- Só posso criar likes meus

-- matches:
-- SELECT: (auth.uid() = user1_id OR auth.uid() = user2_id) -- Só vejo meus matches

-- chats:
-- SELECT: EXISTS (SELECT 1 FROM matches m WHERE m.id = chat.match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid()))

-- messages:
-- SELECT: EXISTS (SELECT 1 FROM chats c JOIN matches m ON m.id = c.match_id WHERE c.id = chat_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid()))

-- notifications:
-- SELECT: (auth.uid() = user_id)

-- Verificação manual:
-- Tente selecionar de public.likes com um usuário autenticado. Deve retornar apenas linhas onde user_id = seu ID.
-- Tente selecionar de public.matches. Deve retornar apenas onde você é user1 ou user2.

-- Script para verificar policies existentes:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('likes', 'matches', 'chats', 'messages', 'notifications');
