-- Migration: Unmatch System
-- 1. Update matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS unmatched_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS unmatched_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_match_status ON public.matches(status);

-- 2. Update chats table
ALTER TABLE public.chats
ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

-- 3. Update notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS message text;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- 4. Create unmatch_user RPC (Transaction)
CREATE OR REPLACE FUNCTION public.unmatch_user(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_partner_id UUID;
    v_chat_id UUID;
BEGIN
    -- Get partner ID and Chat ID
    SELECT 
        CASE 
            WHEN user_a_id = v_user_id THEN user_b_id
            ELSE user_a_id
        END,
        c.id
    INTO v_partner_id, v_chat_id
    FROM matches m
    LEFT JOIN chats c ON c.match_id = m.id
    WHERE m.id = p_match_id AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id);

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Match not found or permission denied';
    END IF;

    -- Update matches
    UPDATE public.matches
    SET status = 'inactive',
        unmatched_by = v_user_id,
        unmatched_at = NOW()
    WHERE id = p_match_id;

    -- Close chat if exists
    IF v_chat_id IS NOT NULL THEN
        UPDATE public.chats
        SET closed_at = NOW()
        WHERE id = v_chat_id;
    END IF;

    -- Create notification for the OTHER user
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_partner_id,
        'system',
        'Match desfeito',
        'O match foi desfeito. A conversa foi encerrada.'
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update list_matches to filter inactive matches
CREATE OR REPLACE FUNCTION public.list_matches()
RETURNS TABLE(
    match_id uuid, 
    event_id uuid, 
    event_title text, 
    partner_id uuid, 
    partner_name text, 
    partner_avatar text, 
    created_at timestamp with time zone, 
    chat_id uuid, 
    match_seen boolean, 
    chat_opened boolean, 
    last_message text, 
    last_message_time timestamp with time zone, 
    unread_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
        (SELECT content FROM messages msg WHERE msg.chat_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message,
        (SELECT msg.created_at FROM messages msg WHERE msg.chat_id = c.id ORDER BY msg.created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages msg 
            WHERE msg.chat_id = c.id 
            AND msg.sender_id != v_user_id 
            AND (msg.status IS DISTINCT FROM 'seen')
        ) as unread_count
    FROM matches m
    JOIN profiles p ON (
        CASE 
            WHEN m.user_a_id = v_user_id THEN m.user_b_id
            ELSE m.user_a_id
        END = p.id
    )
    JOIN events e ON e.id = m.event_id
    LEFT JOIN chats c ON c.match_id = m.id
    WHERE (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND (m.status IS NULL OR m.status = 'active') -- Filter inactive matches
    ORDER BY m.created_at DESC;
END;
$function$;
