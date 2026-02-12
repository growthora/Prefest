CREATE OR REPLACE FUNCTION list_notifications()
RETURNS TABLE (
    id UUID,
    type TEXT,
    event_id UUID,
    reference_id UUID,
    payload JSONB,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.type, n.event_id, n.reference_id, n.payload, n.read_at, n.created_at
    FROM notifications n
    WHERE n.user_id = auth.uid() AND n.dismissed_at IS NULL
    ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
