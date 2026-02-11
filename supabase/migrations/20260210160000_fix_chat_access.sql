-- Fix list_matches to filter only active matches
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
    WHERE (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND m.status = 'active' -- Only show active matches
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create get_match_details RPC with status
CREATE OR REPLACE FUNCTION get_match_details(p_match_id UUID)
RETURNS TABLE (
    match_id UUID,
    event_id UUID,
    event_title TEXT,
    partner_id UUID,
    partner_name TEXT,
    partner_avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    chat_id UUID,
    match_seen BOOLEAN,
    chat_opened BOOLEAN,
    status TEXT
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    SELECT 
        m.id as match_id,
        m.event_id,
        e.title as event_title,
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
        m.status
    FROM matches m
    JOIN events e ON m.event_id = e.id
    JOIN profiles p ON (
        CASE 
            WHEN m.user_a_id = v_user_id THEN m.user_b_id
            ELSE m.user_a_id
        END = p.id
    )
    LEFT JOIN chats c ON c.match_id = m.id
    WHERE m.id = p_match_id
    AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
