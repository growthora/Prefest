-- Fix Asaas config RPC to resolve pgcrypto functions from the extensions schema.
-- This prevents runtime failures such as:
--   function pgp_sym_decrypt(bytea, text) does not exist

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS get_decrypted_asaas_config();

CREATE FUNCTION get_decrypted_asaas_config()
RETURNS TABLE (
  secret_key text,
  webhook_token text,
  env text,
  wallet_id text,
  split_enabled boolean,
  platform_fee_type text,
  platform_fee_value numeric,
  api_key text
) AS $$
DECLARE
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN integrations.secret_key_encrypted IS NULL OR length(trim(integrations.secret_key_encrypted)) = 0 THEN NULL
      ELSE extensions.pgp_sym_decrypt(decode(integrations.secret_key_encrypted, 'base64'), v_encryption_key)
    END AS secret_key,
    CASE
      WHEN integrations.webhook_token_encrypted IS NULL OR length(trim(integrations.webhook_token_encrypted)) = 0 THEN NULL
      ELSE extensions.pgp_sym_decrypt(decode(integrations.webhook_token_encrypted, 'base64'), v_encryption_key)
    END AS webhook_token,
    integrations.environment AS env,
    integrations.wallet_id,
    COALESCE(integrations.split_enabled, true) AS split_enabled,
    COALESCE(integrations.platform_fee_type, 'percentage') AS platform_fee_type,
    COALESCE(integrations.platform_fee_value, 10) AS platform_fee_value,
    CASE
      WHEN integrations.secret_key_encrypted IS NULL OR length(trim(integrations.secret_key_encrypted)) = 0 THEN NULL
      ELSE extensions.pgp_sym_decrypt(decode(integrations.secret_key_encrypted, 'base64'), v_encryption_key)
    END AS api_key
  FROM integrations
  WHERE integrations.provider = 'asaas'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM anon;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO service_role;