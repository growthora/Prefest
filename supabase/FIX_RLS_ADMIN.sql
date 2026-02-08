-- ============================================
-- CORRIGIR POLÍTICAS RLS PARA ADMIN
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/wuqztevrdctctwmetjzn/sql/new

-- ============================================
-- POLÍTICAS PARA TABELA COUPONS
-- ============================================

-- Admin pode fazer SELECT em coupons
DROP POLICY IF EXISTS "Admin pode visualizar todos os cupons" ON coupons;
CREATE POLICY "Admin pode visualizar todos os cupons" ON coupons
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Admin pode fazer INSERT em coupons
DROP POLICY IF EXISTS "Admin pode criar cupons" ON coupons;
CREATE POLICY "Admin pode criar cupons" ON coupons
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Admin pode fazer UPDATE em coupons
DROP POLICY IF EXISTS "Admin pode atualizar cupons" ON coupons;
CREATE POLICY "Admin pode atualizar cupons" ON coupons
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Admin pode fazer DELETE em coupons
DROP POLICY IF EXISTS "Admin pode deletar cupons" ON coupons;
CREATE POLICY "Admin pode deletar cupons" ON coupons
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- ============================================
-- POLÍTICAS PARA TABELA PROFILES
-- ============================================

-- Admin pode visualizar todos os perfis
DROP POLICY IF EXISTS "Admin pode visualizar todos os perfis" ON profiles;
CREATE POLICY "Admin pode visualizar todos os perfis" ON profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
    OR auth.uid() = id
  );

-- Admin pode atualizar perfis
DROP POLICY IF EXISTS "Admin pode atualizar perfis" ON profiles;
CREATE POLICY "Admin pode atualizar perfis" ON profiles
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
    OR auth.uid() = id
  );

-- Admin pode deletar perfis
DROP POLICY IF EXISTS "Admin pode deletar perfis" ON profiles;
CREATE POLICY "Admin pode deletar perfis" ON profiles
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- ============================================
-- POLÍTICAS PARA TABELA EVENTS
-- ============================================

-- Admin pode visualizar todos os eventos
DROP POLICY IF EXISTS "Admin pode visualizar eventos" ON events;
CREATE POLICY "Admin pode visualizar eventos" ON events
  FOR SELECT
  USING (true); -- Todos podem ver eventos

-- Admin pode criar eventos
DROP POLICY IF EXISTS "Admin pode criar eventos" ON events;
CREATE POLICY "Admin pode criar eventos" ON events
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Admin pode atualizar eventos
DROP POLICY IF EXISTS "Admin pode atualizar eventos" ON events;
CREATE POLICY "Admin pode atualizar eventos" ON events
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Admin pode deletar eventos
DROP POLICY IF EXISTS "Admin pode deletar eventos" ON events;
CREATE POLICY "Admin pode deletar eventos" ON events
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- ============================================
-- POLÍTICAS PARA TABELA EVENT_PARTICIPANTS
-- ============================================

-- Admin pode visualizar todos os participantes
DROP POLICY IF EXISTS "Admin pode visualizar participantes" ON event_participants;
CREATE POLICY "Admin pode visualizar participantes" ON event_participants
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'equipe')
    )
    OR user_id = auth.uid()
  );

-- Admin pode atualizar participantes
DROP POLICY IF EXISTS "Admin pode atualizar participantes" ON event_participants;
CREATE POLICY "Admin pode atualizar participantes" ON event_participants
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'equipe')
    )
  );

-- Verificar se RLS está habilitado
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Conceder permissões ao authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_participants TO authenticated;
