-- Update get_decrypted_asaas_config to return all fields needed for global split configuration
-- and match the expectations of the Edge Functions (api_key, wallet_id, etc.)

CREATE OR REPLACE FUNCTION get_decrypted_asaas_config()
RETURNS TABLE (
  api_key text,
  webhook_token text,
  env text,
  wallet_id text,
  split_enabled boolean,
  platform_fee_type text,
  platform_fee_value numeric,
  is_enabled boolean
) AS $$
DECLARE
  -- Must match the key used in save_admin_settings
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
BEGIN
  RETURN QUERY
  SELECT 
    pgp_sym_decrypt(decode(secret_key_encrypted, 'base64'), v_encryption_key) as api_key,
    pgp_sym_decrypt(decode(webhook_token_encrypted, 'base64'), v_encryption_key) as webhook_token,
    environment as env,
    wallet_id,
    split_enabled,
    platform_fee_type,
    (platform_fee_value::numeric) as platform_fee_value,
    is_enabled
  FROM integrations
  WHERE provider = 'asaas'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to service_role only (Backend/Edge Functions)
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM anon;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO service_role;
