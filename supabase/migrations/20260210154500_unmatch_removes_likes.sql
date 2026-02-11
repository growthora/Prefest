-- Update unmatch_user to remove likes
CREATE OR REPLACE FUNCTION public.unmatch_user(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_partner_id UUID;
    v_chat_id UUID;
    v_event_id UUID;
BEGIN
    -- Get partner ID, Chat ID, and Event ID
    SELECT 
        CASE 
            WHEN user_a_id = v_user_id THEN user_b_id
            ELSE user_a_id
        END,
        c.id,
        m.event_id
    INTO v_partner_id, v_chat_id, v_event_id
    FROM matches m
    LEFT JOIN chats c ON c.match_id = m.id
    WHERE m.id = p_match_id AND (m.user_a_id = v_user_id OR m.user_b_id = v_user_id);

    IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Match not found or permission denied';
    END IF;

    -- Update matches to inactive
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

    -- Remove LIKES (Mutual Unlink)
    -- Remove my like to partner in this event
    DELETE FROM public.likes 
    WHERE from_user_id = v_user_id 
    AND to_user_id = v_partner_id
    AND event_id = v_event_id;

    -- Remove partner's like to me in this event (Optional: usually unmatch removes the connection, 
    -- but removing both likes ensures a clean slate and prevents accidental re-match logic if based on existing likes)
    DELETE FROM public.likes
    WHERE from_user_id = v_partner_id
    AND to_user_id = v_user_id
    AND event_id = v_event_id;

    -- Create notification for the OTHER user
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_partner_id,
        'system',
        'Match desfeito',
        'O match foi desfeito. A conversa foi encerrada e a curtida removida.'
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
