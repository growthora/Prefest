
-- Create user_presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_chat_id UUID, -- NULL means not in any chat
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all presence"
    ON public.user_presence FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own presence"
    ON public.user_presence FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence update"
    ON public.user_presence FOR UPDATE
    USING (auth.uid() = user_id);

-- Upsert helper function for frontend
CREATE OR REPLACE FUNCTION public.update_presence(p_chat_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, active_chat_id, last_seen_at)
    VALUES (auth.uid(), p_chat_id, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        active_chat_id = EXCLUDED.active_chat_id,
        last_seen_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle auto-SEEN
CREATE OR REPLACE FUNCTION public.handle_new_message_auto_seen()
RETURNS TRIGGER AS $$
DECLARE
    v_receiver_id UUID;
    v_receiver_active BOOLEAN;
BEGIN
    -- Find the receiver (the other participant in the chat)
    SELECT user_id INTO v_receiver_id
    FROM public.chat_participants
    WHERE chat_id = NEW.chat_id
    AND user_id != NEW.sender_id
    LIMIT 1;

    -- If receiver found, check if they are active in this chat
    IF v_receiver_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_presence
            WHERE user_id = v_receiver_id
            AND active_chat_id = NEW.chat_id
        ) INTO v_receiver_active;

        -- If active, mark message as seen immediately
        IF v_receiver_active THEN
            -- Update the message status. 
            -- Since this is an AFTER INSERT trigger (recommended for side effects), 
            -- we update the table.
            -- If it were BEFORE INSERT, we could modify NEW, but we need to know the ID which is fine.
            -- However, updating the row triggers a new event (UPDATE), which the frontend listens to.
            UPDATE public.messages
            SET status = 'seen',
                read_at = NOW()
            WHERE id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
DROP TRIGGER IF EXISTS on_new_message_auto_seen ON public.messages;
CREATE TRIGGER on_new_message_auto_seen
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_auto_seen();
