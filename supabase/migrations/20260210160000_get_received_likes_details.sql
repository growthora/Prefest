CREATE OR REPLACE FUNCTION public.get_received_likes(p_event_id uuid)
 RETURNS TABLE(
    like_id uuid, 
    from_user_id uuid, 
    event_id uuid, 
    created_at timestamp with time zone, 
    status text,
    from_user_name text,
    from_user_photo text,
    from_user_age int,
    from_user_bio text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as like_id,
        l.from_user_id,
        l.event_id,
        l.created_at,
        l.status,
        p.full_name as from_user_name,
        p.avatar_url as from_user_photo,
        EXTRACT(YEAR FROM AGE(p.birth_date))::int as from_user_age,
        p.bio as from_user_bio
    FROM likes l
    JOIN profiles p ON p.id = l.from_user_id
    WHERE l.to_user_id = auth.uid()
    AND l.event_id = p_event_id
    AND (l.status = 'pending' OR l.status IS NULL)
    AND NOT EXISTS (
        SELECT 1 FROM likes l2 
        WHERE l2.from_user_id = auth.uid() 
        AND l2.to_user_id = l.from_user_id 
        AND l2.event_id = p_event_id
    );
END;
$function$
