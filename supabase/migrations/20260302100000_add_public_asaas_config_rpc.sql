-- Create a secure function to get public Asaas fee configuration
-- This avoids exposing sensitive API keys

CREATE OR REPLACE FUNCTION get_public_asaas_config()
RETURNS TABLE (
  is_enabled boolean,
  environment text,
  split_enabled boolean,
  platform_fee_type text,
  platform_fee_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.is_enabled,
    i.environment,
    i.split_enabled,
    i.platform_fee_type,
    (i.platform_fee_value::numeric) as platform_fee_value
  FROM integrations i
  WHERE i.provider = 'asaas'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to public (anon and authenticated)
GRANT EXECUTE ON FUNCTION get_public_asaas_config() TO anon;
GRANT EXECUTE ON FUNCTION get_public_asaas_config() TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_asaas_config() TO service_role;
