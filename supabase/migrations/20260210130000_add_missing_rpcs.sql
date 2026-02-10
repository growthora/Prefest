-- RPC: List Likes Summary
CREATE OR REPLACE FUNCTION list_likes_summary()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INTEGER;
    v_recent_likes JSONB;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM likes
    WHERE to_user_id = v_user_id;

    -- Get last 5 likes avatars (to show as "recent likes")
    SELECT jsonb_agg(jsonb_build_object('avatar_url', p.avatar_url, 'created_at', l.created_at))
    INTO v_recent_likes
    FROM likes l
    JOIN profiles p ON l.from_user_id = p.id
    WHERE l.to_user_id = v_user_id
    ORDER BY l.created_at DESC
    LIMIT 5;

    RETURN jsonb_build_object(
        'total_likes', v_count,
        'recent_likes', COALESCE(v_recent_likes, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get or Create Chat
CREATE OR REPLACE FUNCTION get_or_create_chat(p_match_id UUID)
RETURNS UUID AS $$
DECLARE
    v_chat_id UUID;
    v_event_id UUID;
    v_user_a_id UUID;
    v_user_b_id UUID;
BEGIN
    -- Check if chat exists
    SELECT id INTO v_chat_id FROM chats WHERE match_id = p_match_id;
    
    IF v_chat_id IS NOT NULL THEN
        RETURN v_chat_id;
    END IF;

    -- Get match details
    SELECT event_id, user_a_id, user_b_id INTO v_event_id, v_user_a_id, v_user_b_id
    FROM matches WHERE id = p_match_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    -- Create Chat
    INSERT INTO chats (event_id, match_id)
    VALUES (v_event_id, p_match_id)
    ON CONFLICT (event_id, match_id) DO UPDATE SET created_at = chats.created_at
    RETURNING id INTO v_chat_id;

    -- Add Participants
    INSERT INTO chat_participants (chat_id, user_id)
    VALUES (v_chat_id, v_user_a_id), (v_chat_id, v_user_b_id)
    ON CONFLICT DO NOTHING;

    RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
