-- ============================================
-- CORRIGIR TODAS AS POLÍTICAS RLS
-- ============================================
-- Execute TUDO este SQL no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- Remover políticas antigas de coupons
DROP POLICY IF EXISTS "Admin pode visualizar todos os cupons" ON coupons;
DROP POLICY IF EXISTS "Admin pode criar cupons" ON coupons;
DROP POLICY IF EXISTS "Admin pode atualizar cupons" ON coupons;
DROP POLICY IF EXISTS "Admin pode deletar cupons" ON coupons;
DROP POLICY IF EXISTS "Users can view active coupons" ON coupons;
DROP POLICY IF EXISTS "Admin full access coupons" ON coupons;
DROP POLICY IF EXISTS "Users view active coupons" ON coupons;

-- Remover políticas antigas de profiles
DROP POLICY IF EXISTS "Admin pode visualizar todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON profiles;
DROP POLICY IF EXISTS "Admin pode deletar perfis" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Users own profile" ON profiles;
DROP POLICY IF EXISTS "Users view single mode profiles" ON profiles;
DROP POLICY IF EXISTS "Admin all profiles" ON profiles;

-- Remover políticas antigas de events
DROP POLICY IF EXISTS "Admin pode visualizar eventos" ON events;
DROP POLICY IF EXISTS "Admin pode criar eventos" ON events;
DROP POLICY IF EXISTS "Admin pode atualizar eventos" ON events;
DROP POLICY IF EXISTS "Admin pode deletar eventos" ON events;
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Everyone view events" ON events;
DROP POLICY IF EXISTS "Admin manage events" ON events;
DROP POLICY IF EXISTS "Admin update events" ON events;
DROP POLICY IF EXISTS "Admin delete events" ON events;

-- Remover políticas antigas de event_participants
DROP POLICY IF EXISTS "Admin pode visualizar participantes" ON event_participants;
DROP POLICY IF EXISTS "Admin pode atualizar participantes" ON event_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON event_participants;
DROP POLICY IF EXISTS "Equipe pode validar ingressos" ON event_participants;
DROP POLICY IF EXISTS "Admin and Equipe full access participants" ON event_participants;
DROP POLICY IF EXISTS "Users own participations" ON event_participants;
DROP POLICY IF EXISTS "Users view event participants" ON event_participants;
DROP POLICY IF EXISTS "Admin and Equipe manage participants" ON event_participants;

-- ============================================
-- 2. CRIAR POLÍTICAS CORRETAS
-- ============================================

-- Criar função auxiliar para verificar role (evita recursão)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- TABELA: coupons
-- ============================================

-- Admin: acesso total
CREATE POLICY "Admin full access coupons" ON coupons
  FOR ALL
  USING (public.current_user_role() = 'admin');

-- Usuários: ver cupons ativos
CREATE POLICY "Users view active coupons" ON coupons
  FOR SELECT
  USING (
    active = true 
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until >= NOW())
  );

-- ============================================
-- TABELA: profiles
-- ============================================

-- Todos podem ver e editar seu próprio perfil
CREATE POLICY "Users own profile" ON profiles
  FOR ALL
  USING (id = auth.uid());

-- Admin pode ver e editar todos os perfis
CREATE POLICY "Admin all profiles" ON profiles
  FOR ALL
  USING (public.current_user_role() = 'admin');

-- Usuários podem ver perfis com single_mode ativo
CREATE POLICY "Users view single mode profiles" ON profiles
  FOR SELECT
  USING (single_mode = true);

-- ============================================
-- TABELA: events
-- ============================================

-- Todos: visualizar eventos
CREATE POLICY "Everyone view events" ON events
  FOR SELECT
  USING (true);

-- Admin: criar, editar, deletar eventos
CREATE POLICY "Admin manage events" ON events
  FOR INSERT
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "Admin update events" ON events
  FOR UPDATE
  USING (public.current_user_role() = 'admin');

CREATE POLICY "Admin delete events" ON events
  FOR DELETE
  USING (public.current_user_role() = 'admin');

-- ============================================
-- TABELA: event_participants
-- ============================================

-- Admin e Equipe: acesso total
CREATE POLICY "Admin and Equipe manage participants" ON event_participants
  FOR ALL
  USING (public.current_user_role() IN ('admin', 'equipe'));

-- Usuários: ver e gerenciar próprias participações
CREATE POLICY "Users own participations" ON event_participants
  FOR ALL
  USING (user_id = auth.uid());

-- Usuários: ver participantes de eventos (com single_mode) - SEM SUBQUERY RECURSIVA
CREATE POLICY "Users view event participants" ON event_participants
  FOR SELECT
  USING (
    (SELECT single_mode FROM profiles WHERE id = event_participants.user_id) = true
  );

-- ============================================
-- 3. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. VERIFICAR CONFIGURAÇÃO
-- ============================================

-- Mostrar todas as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('coupons', 'profiles', 'events', 'event_participants')
ORDER BY tablename, policyname;
