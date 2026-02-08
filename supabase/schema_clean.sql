-- ============================================
-- SCRIPT DE LIMPEZA E RECRIAÇÃO COMPLETA
-- Execute este script para resetar o banco
-- ============================================

-- Remover tabelas (CASCADE remove triggers automaticamente)
DROP TABLE IF EXISTS coupon_usage CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS event_participants CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Remover funções (se existirem)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_event_participants() CASCADE;
DROP FUNCTION IF EXISTS decrement_event_participants() CASCADE;
DROP FUNCTION IF EXISTS increment_coupon_usage() CASCADE;

-- ============================================
-- CRIAR TABELAS
-- ============================================

-- Criar tabela de perfis de usuários
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'equipe')),
  single_mode BOOLEAN DEFAULT false,
  show_initials_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar tabela de eventos
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  price DECIMAL(10, 2) DEFAULT 0,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar tabela de participantes em eventos
CREATE TABLE event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticket_quantity INTEGER DEFAULT 1,
  total_paid DECIMAL(10, 2),
  ticket_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  qr_code_data TEXT,
  status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'canceled')),
  used_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(event_id, user_id)
);

-- Criar tabela de matches/conexões
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(user1_id, user2_id, event_id)
);

-- Criar tabela de mensagens de chat
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela de cupons de desconto
CREATE TABLE coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  valid_until TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar tabela de uso de cupons
CREATE TABLE coupon_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  discount_applied DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(coupon_id, user_id, event_id)
);

-- ============================================
-- HABILITAR RLS (Row Level Security)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES PARA PROFILES
-- ============================================

CREATE POLICY "Perfis públicos são visíveis para todos" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Usuários podem inserir seu próprio perfil" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- POLICIES PARA EVENTS
-- ============================================

CREATE POLICY "Eventos são visíveis para todos" ON events
  FOR SELECT USING (true);

CREATE POLICY "Usuários autenticados podem criar eventos" ON events
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Criadores podem atualizar seus eventos" ON events
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Criadores podem deletar seus eventos" ON events
  FOR DELETE USING (auth.uid() = creator_id);

-- ============================================
-- POLICIES PARA EVENT_PARTICIPANTS
-- ============================================

CREATE POLICY "Participantes são visíveis para todos" ON event_participants
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem se inscrever em eventos" ON event_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem cancelar sua participação" ON event_participants
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Equipe pode validar ingressos" ON event_participants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'equipe'))
  );

-- ============================================
-- POLICIES PARA MATCHES
-- ============================================

CREATE POLICY "Usuários veem seus próprios matches" ON matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Usuários podem criar matches" ON matches
  FOR INSERT WITH CHECK (auth.uid() = user1_id);

CREATE POLICY "Usuários podem atualizar seus matches" ON matches
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- ============================================
-- POLICIES PARA MESSAGES
-- ============================================

CREATE POLICY "Usuários veem mensagens de seus matches" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

CREATE POLICY "Usuários podem enviar mensagens em seus matches" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = messages.match_id 
      AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
    )
  );

-- ============================================
-- POLICIES PARA COUPONS
-- ============================================

CREATE POLICY "Cupons ativos são visíveis para todos" ON coupons
  FOR SELECT USING (active = true);

CREATE POLICY "Apenas admins podem criar cupons" ON coupons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Apenas admins podem atualizar cupons" ON coupons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Apenas admins podem deletar cupons" ON coupons
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- POLICIES PARA COUPON_USAGE
-- ============================================

CREATE POLICY "Usuários veem seu próprio uso de cupons" ON coupon_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem usar cupons" ON coupon_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para incrementar participantes
CREATE OR REPLACE FUNCTION increment_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE events 
  SET current_participants = current_participants + NEW.ticket_quantity
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para decrementar participantes
CREATE OR REPLACE FUNCTION decrement_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE events 
  SET current_participants = current_participants - OLD.ticket_quantity
  WHERE id = OLD.event_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers para gerenciar contagem de participantes
CREATE TRIGGER increment_participants_trigger
  AFTER INSERT ON event_participants
  FOR EACH ROW EXECUTE FUNCTION increment_event_participants();

CREATE TRIGGER decrement_participants_trigger
  AFTER DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION decrement_event_participants();

-- Função para incrementar uso de cupom
CREATE OR REPLACE FUNCTION increment_coupon_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE coupons 
  SET current_uses = current_uses + 1
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para incrementar uso de cupom
CREATE TRIGGER increment_coupon_usage_trigger
  AFTER INSERT ON coupon_usage
  FOR EACH ROW EXECUTE FUNCTION increment_coupon_usage();

-- ============================================
-- FUNÇÃO PARA VALIDAR QR CODE
-- ============================================

CREATE OR REPLACE FUNCTION validate_ticket(p_ticket_token UUID, p_validator_id UUID)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
  v_event RECORD;
  v_result JSON;
BEGIN
  -- Buscar ingresso pelo token
  SELECT * INTO v_ticket
  FROM event_participants
  WHERE ticket_token = p_ticket_token;
  
  -- Verificar se o ingresso existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso não encontrado',
      'status', 'invalid'
    );
  END IF;
  
  -- Verificar se o ingresso já foi usado
  IF v_ticket.status = 'used' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso já foi utilizado',
      'status', 'used',
      'used_at', v_ticket.used_at
    );
  END IF;
  
  -- Verificar se o ingresso foi cancelado
  IF v_ticket.status = 'canceled' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Ingresso cancelado',
      'status', 'canceled'
    );
  END IF;
  
  -- Buscar informações do evento
  SELECT * INTO v_event
  FROM events
  WHERE id = v_ticket.event_id;
  
  -- Marcar ingresso como usado
  UPDATE event_participants
  SET 
    status = 'used',
    used_at = NOW(),
    validated_by = p_validator_id
  WHERE ticket_token = p_ticket_token;
  
  -- Retornar sucesso com informações do ingresso
  RETURN json_build_object(
    'success', true,
    'message', 'Ingresso validado com sucesso',
    'status', 'valid',
    'event_title', v_event.title,
    'event_date', v_event.event_date,
    'participant_name', (SELECT full_name FROM profiles WHERE id = v_ticket.user_id),
    'validated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CONCLUÍDO!
-- ============================================
