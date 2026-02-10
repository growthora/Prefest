-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Add Columns to Profiles (if not exist)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS match_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_profile_view BOOLEAN DEFAULT true;

-- 1. Likes Table
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, from_user_id, to_user_id)
);

-- 2. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_a_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT matches_users_order CHECK (user_a_id < user_b_id),
    UNIQUE(event_id, user_a_id, user_b_id)
);

-- 3. Chats Table
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, match_id)
);

-- 4. Chat Participants Table
CREATE TABLE IF NOT EXISTS chat_participants (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (chat_id, user_id)
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'match', 'system')),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    payload JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
DROP POLICY IF EXISTS "Users can view likes they created" ON likes;
DROP POLICY IF EXISTS "Users can view their matches" ON matches;
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;
DROP POLICY IF EXISTS "Users can view participants of their chats" ON chat_participants;
DROP POLICY IF EXISTS "Users can view messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON messages;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Likes policies
CREATE POLICY "Users can insert their own likes" ON likes FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can view likes they created" ON likes FOR SELECT USING (auth.uid() = from_user_id);

-- Matches policies
CREATE POLICY "Users can view their matches" ON matches FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Chats policies
CREATE POLICY "Users can view chats they participate in" ON chats FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = id AND user_id = auth.uid())
);

-- Chat Participants policies
CREATE POLICY "Users can view participants of their chats" ON chat_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chat_id AND cp.user_id = auth.uid())
);

-- Messages policies
CREATE POLICY "Users can view messages in their chats" ON messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = messages.chat_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert messages in their chats" ON messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = chat_id AND user_id = auth.uid())
);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_likes_from_event ON likes(from_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_likes_to_event ON likes(to_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

-- RPC: Like User
CREATE OR REPLACE FUNCTION like_user(
    p_event_id UUID,
    p_to_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_from_user_id UUID := auth.uid();
    v_existing_like UUID;
    v_inverse_like_exists BOOLEAN;
    v_match_id UUID;
    v_chat_id UUID;
    v_user_a_id UUID;
    v_user_b_id UUID;
    v_event_title TEXT;
    v_result JSONB;
BEGIN
    -- Validate IDs
    IF v_from_user_id IS NULL THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'User not authenticated');
    END IF;

    -- Check if self-like
    IF v_from_user_id = p_to_user_id THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Cannot like yourself');
    END IF;

    -- Check permissions (match_enabled and allow_profile_view)
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = v_from_user_id 
        AND match_enabled = true 
        AND allow_profile_view = true
    ) THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'You have not enabled matching');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_to_user_id 
        AND match_enabled = true 
        AND allow_profile_view = true
    ) THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'User is not available for matching');
    END IF;

    -- Check if already liked
    SELECT id INTO v_existing_like FROM likes 
    WHERE event_id = p_event_id AND from_user_id = v_from_user_id AND to_user_id = p_to_user_id;

    IF v_existing_like IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'already_liked');
    END IF;

    -- Insert Like
    INSERT INTO likes (event_id, from_user_id, to_user_id)
    VALUES (p_event_id, v_from_user_id, p_to_user_id);

    -- Get Event Name
    SELECT title INTO v_event_title FROM events WHERE id = p_event_id;

    -- Check Inverse Like
    SELECT EXISTS (
        SELECT 1 FROM likes 
        WHERE event_id = p_event_id AND from_user_id = p_to_user_id AND to_user_id = v_from_user_id
    ) INTO v_inverse_like_exists;

    IF v_inverse_like_exists THEN
        -- IT'S A MATCH!
        
        -- Determine User A and User B
        IF v_from_user_id < p_to_user_id THEN
            v_user_a_id := v_from_user_id;
            v_user_b_id := p_to_user_id;
        ELSE
            v_user_a_id := p_to_user_id;
            v_user_b_id := v_from_user_id;
        END IF;

        -- Create Match
        INSERT INTO matches (event_id, user_a_id, user_b_id)
        VALUES (p_event_id, v_user_a_id, v_user_b_id)
        ON CONFLICT (event_id, user_a_id, user_b_id) DO UPDATE SET created_at = matches.created_at
        RETURNING id INTO v_match_id;

        -- Create Chat
        INSERT INTO chats (event_id, match_id)
        VALUES (p_event_id, v_match_id)
        ON CONFLICT (event_id, match_id) DO UPDATE SET created_at = chats.created_at
        RETURNING id INTO v_chat_id;

        -- Add Participants
        INSERT INTO chat_participants (chat_id, user_id)
        VALUES (v_chat_id, v_user_a_id), (v_chat_id, v_user_b_id)
        ON CONFLICT DO NOTHING;

        -- Notify Both Users (Match)
        INSERT INTO notifications (user_id, type, event_id, payload)
        VALUES 
            (v_from_user_id, 'match', p_event_id, jsonb_build_object('match_id', v_match_id, 'chat_id', v_chat_id, 'event_name', v_event_title, 'partner_id', p_to_user_id)),
            (p_to_user_id, 'match', p_event_id, jsonb_build_object('match_id', v_match_id, 'chat_id', v_chat_id, 'event_name', v_event_title, 'partner_id', v_from_user_id));

        v_result := jsonb_build_object('status', 'match', 'match_id', v_match_id, 'chat_id', v_chat_id);
    ELSE
        -- JUST A LIKE
        -- Notify Target User (Anonymous Like)
        INSERT INTO notifications (user_id, type, event_id, payload)
        VALUES (p_to_user_id, 'like', p_event_id, jsonb_build_object('message', 'Você recebeu uma nova curtida!', 'event_name', v_event_title));
        
        v_result := jsonb_build_object('status', 'liked');
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: List Notifications
CREATE OR REPLACE FUNCTION list_notifications()
RETURNS TABLE (
    id UUID,
    type TEXT,
    event_id UUID,
    payload JSONB,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.type, n.event_id, n.payload, n.read_at, n.created_at
    FROM notifications n
    WHERE n.user_id = auth.uid() AND n.dismissed_at IS NULL
    ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Dismiss Notification
CREATE OR REPLACE FUNCTION dismiss_notification(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notifications
    SET dismissed_at = now()
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get Matches
CREATE OR REPLACE FUNCTION list_matches()
RETURNS TABLE (
    match_id UUID,
    event_id UUID,
    partner_id UUID,
    partner_name TEXT,
    partner_avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    chat_id UUID
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    SELECT 
        m.id as match_id,
        m.event_id,
        CASE 
            WHEN m.user_a_id = v_user_id THEN m.user_b_id
            ELSE m.user_a_id
        END as partner_id,
        p.full_name as partner_name,
        p.avatar_url as partner_avatar,
        m.created_at,
        c.id as chat_id
    FROM matches m
    JOIN profiles p ON (
        CASE 
            WHEN m.user_a_id = v_user_id THEN m.user_b_id
            ELSE m.user_a_id
        END = p.id
    )
    LEFT JOIN chats c ON c.match_id = m.id
    WHERE m.user_a_id = v_user_id OR m.user_b_id = v_user_id
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get or Create Chat
CREATE OR REPLACE FUNCTION get_or_create_chat(p_match_id UUID)
RETURNS UUID AS $$
DECLARE
    v_chat_id UUID;
    v_match RECORD;
BEGIN
    -- Check if chat exists
    SELECT id INTO v_chat_id FROM chats WHERE match_id = p_match_id;
    
    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Get match details
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    
    IF v_match IS NULL THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    -- Create chat
    INSERT INTO chats (event_id, match_id)
    VALUES (v_match.event_id, p_match_id)
    RETURNING id INTO v_chat_id;

    -- Add participants
    INSERT INTO chat_participants (chat_id, user_id)
    VALUES (v_chat_id, v_match.user_a_id), (v_chat_id, v_match.user_b_id)
    ON CONFLICT DO NOTHING;

    RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
