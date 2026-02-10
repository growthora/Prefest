-- 1. Add deleted_at column to chat_participants
ALTER TABLE public.chat_participants 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Soft Delete RPC
CREATE OR REPLACE FUNCTION public.soft_delete_chat(p_chat_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.chat_participants
    SET deleted_at = NOW()
    WHERE chat_id = p_chat_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Undelete Trigger on new message
CREATE OR REPLACE FUNCTION public.handle_undelete_chat_on_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Un-delete for ALL participants when a new message arrives
    UPDATE public.chat_participants
    SET deleted_at = NULL
    WHERE chat_id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_new_message_undelete ON public.messages;
CREATE TRIGGER on_new_message_undelete
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_undelete_chat_on_message();

-- 4. Update list_matches to include event_title and filter deleted chats
CREATE OR REPLACE FUNCTION public.list_matches()
 RETURNS TABLE(match_id uuid, event_id uuid, event_title text, partner_id uuid, partner_name text, partner_avatar text, created_at timestamp with time zone, chat_id uuid, match_seen boolean, chat_opened boolean, last_message text, last_message_time timestamp with time zone, unread_count bigint)
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
    LEFT JOIN chat_participants cp ON cp.chat_id = c.id AND cp.user_id = v_user_id
    WHERE (m.user_a_id = v_user_id OR m.user_b_id = v_user_id)
    AND (c.id IS NULL OR cp.deleted_at IS NULL)
    ORDER BY m.created_at DESC;
END;
$function$;
