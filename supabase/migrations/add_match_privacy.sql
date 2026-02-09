-- Add privacy fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"show_age": true, "show_height": true, "show_instagram": false, "show_relationship": true}'::jsonb,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- Create index for last_seen to optimize queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);

-- Function to get match candidates with privacy filtering
CREATE OR REPLACE FUNCTION get_match_candidates(event_uuid UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  age INTEGER,
  height NUMERIC,
  relationship_status TEXT,
  match_intention TEXT,
  vibes TEXT[],
  last_seen TIMESTAMPTZ,
  is_online BOOLEAN
) AS $$
DECLARE
  requesting_user_id UUID;
BEGIN
  -- Get the ID of the user calling the function
  requesting_user_id := auth.uid();

  RETURN QUERY
  SELECT 
    p.id,
    -- Always visible fields
    p.full_name,
    p.avatar_url,
    p.bio,
    -- Conditionally visible fields based on privacy_settings
    CASE 
      WHEN (p.privacy_settings->>'show_age')::boolean IS TRUE THEN 
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date::date))::integer
      ELSE NULL 
    END as age,
    
    CASE 
      WHEN (p.privacy_settings->>'show_height')::boolean IS TRUE THEN p.height
      ELSE NULL 
    END as height,
    
    CASE 
      WHEN (p.privacy_settings->>'show_relationship')::boolean IS TRUE THEN p.relationship_status
      ELSE NULL 
    END as relationship_status,
    
    -- Fields that depend on match_enabled (already filtered by WHERE clause, but good to be safe)
    p.match_intention,
    p.looking_for as vibes, -- Mapping looking_for to vibes for now
    p.last_seen,
    
    -- Calculate online status (active in last 15 minutes)
    CASE 
      WHEN p.last_seen > (NOW() - INTERVAL '15 minutes') THEN TRUE 
      ELSE FALSE 
    END as is_online

  FROM event_participants ep
  JOIN profiles p ON ep.user_id = p.id
  WHERE 
    ep.event_id = event_uuid
    AND p.match_enabled = true
    AND p.id != requesting_user_id -- Don't show myself
    -- Only show users active in the last 24 hours
    AND p.last_seen > (NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
