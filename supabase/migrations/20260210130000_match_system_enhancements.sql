
-- Add status column to likes table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'status') THEN
        ALTER TABLE likes ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'ignored'));
    END IF;
END $$;

-- Add match_seen and chat_opened to matches table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'match_seen') THEN
        ALTER TABLE matches ADD COLUMN match_seen BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'chat_opened') THEN
        ALTER TABLE matches ADD COLUMN chat_opened BOOLEAN DEFAULT false;
    END IF;
END $$;

-- RPC: Get Received Likes (Anonymous)
CREATE OR REPLACE FUNCTION get_received_likes(p_event_id UUID)
RETURNS TABLE (
    like_id UUID,
    from_user_id UUID,
    event_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as like_id,
        l.from_user_id,
        l.event_id,
        l.created_at,
        l.status
    FROM likes l
    WHERE l.to_user_id = auth.uid()
    AND l.event_id = p_event_id
    AND l.status = 'pending'
    AND NOT EXISTS (
        -- Ensure we haven't liked them back yet (which would make it a match, handled elsewhere but good for safety)
        SELECT 1 FROM likes l2 
        WHERE l2.from_user_id = auth.uid() 
        AND l2.to_user_id = l.from_user_id 
        AND l2.event_id = p_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Ignore Like
CREATE OR REPLACE FUNCTION ignore_like(p_like_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE likes
    SET status = 'ignored'
    WHERE id = p_like_id AND to_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update list_matches to include new columns
CREATE OR REPLACE FUNCTION list_matches()
RETURNS TABLE (
    match_id UUID,
    event_id UUID,
    partner_id UUID,
    partner_name TEXT,
    partner_avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    chat_id UUID,
    match_seen BOOLEAN,
    chat_opened BOOLEAN,
    last_message TEXT,
    last_message_time TIMESTAMP WITH TIME ZONE,
    unread_count BIGINT
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
        c.id as chat_id,
        m.match_seen,
        m.chat_opened,
        (SELECT content FROM messages msg WHERE msg.chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages msg WHERE msg.chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages msg WHERE msg.chat_id = c.id AND msg.sender_id != v_user_id AND (msg.created_at > COALESCE((SELECT read_at FROM notifications n WHERE n.user_id = v_user_id AND n.type = 'message' AND (n.payload->>'chat_id')::UUID = c.id ORDER BY created_at DESC LIMIT 1), '1970-01-01'::timestamp))) as unread_count
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

-- RPC: Mark Match Seen
CREATE OR REPLACE FUNCTION mark_match_seen(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE matches
    SET match_seen = true
    WHERE id = p_match_id AND (user_a_id = auth.uid() OR user_b_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Mark Chat Opened
CREATE OR REPLACE FUNCTION mark_chat_opened(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE matches
    SET chat_opened = true
    WHERE id = p_match_id AND (user_a_id = auth.uid() OR user_b_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update like_user to set status='matched' on the original like when a match occurs
CREATE OR REPLACE FUNCTION like_user(
    p_event_id UUID,
    p_to_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_from_user_id UUID := auth.uid();
    v_existing_like_id UUID;
    v_inverse_like_id UUID;
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
    SELECT id INTO v_existing_like_id FROM likes 
    WHERE event_id = p_event_id AND from_user_id = v_from_user_id AND to_user_id = p_to_user_id;

    IF v_existing_like_id IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'already_liked');
    END IF;

    -- Insert Like (Pending initially)
    INSERT INTO likes (event_id, from_user_id, to_user_id, status)
    VALUES (p_event_id, v_from_user_id, p_to_user_id, 'pending');

    -- Get Event Name
    SELECT title INTO v_event_title FROM events WHERE id = p_event_id;

    -- Check Inverse Like
    SELECT id INTO v_inverse_like_id FROM likes 
    WHERE event_id = p_event_id AND from_user_id = p_to_user_id AND to_user_id = v_from_user_id;

    IF v_inverse_like_id IS NOT NULL THEN
        -- IT'S A MATCH!
        
        -- Update both likes to 'matched'
        UPDATE likes SET status = 'matched' WHERE event_id = p_event_id AND ((from_user_id = v_from_user_id AND to_user_id = p_to_user_id) OR (from_user_id = p_to_user_id AND to_user_id = v_from_user_id));

        -- Determine User A and User B
        IF v_from_user_id < p_to_user_id THEN
            v_user_a_id := v_from_user_id;
            v_user_b_id := p_to_user_id;
        ELSE
            v_user_a_id := p_to_user_id;
            v_user_b_id := v_from_user_id;
        END IF;

        -- Create Match
        INSERT INTO matches (event_id, user_a_id, user_b_id, match_seen, chat_opened)
        VALUES (p_event_id, v_user_a_id, v_user_b_id, false, false)
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
