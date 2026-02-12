-- Drop old triggers and function to clean up legacy logic
DROP TRIGGER IF EXISTS on_event_created ON events;
DROP TRIGGER IF EXISTS on_event_published ON events;
DROP FUNCTION IF EXISTS handle_new_event_notification();

-- Create new function for event notifications that works with current schema
CREATE OR REPLACE FUNCTION handle_new_event_notification_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify on published events. 
    -- Check if it's a new published event OR an update to published status
    IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR 
       (TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published') THEN
       
        -- Insert notification for ALL users except creator
        INSERT INTO notifications (user_id, type, event_id, payload)
        SELECT 
            p.id as user_id,
            'system' as type,
            NEW.id as event_id,
            jsonb_build_object(
                'title', 'Novo evento disponível!',
                'message', 'Confira o evento ' || NEW.title,
                'event_id', NEW.id,
                'type', 'new_event'
            ) as payload
        FROM profiles p
        WHERE p.id != NEW.creator_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_event_published_v2
    AFTER INSERT OR UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_event_notification_v2();
