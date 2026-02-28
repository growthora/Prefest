-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to get decrypted Asaas config safely
-- This function is SECURITY DEFINER to access the encrypted keys
-- It should only be callable by service_role (Edge Functions)

CREATE OR REPLACE FUNCTION get_decrypted_asaas_config()
RETURNS TABLE (
  secret_key text,
  webhook_token text,
  env text
) AS $$
DECLARE
  v_encryption_key text := 'super_secret_encryption_key_123';
BEGIN
  RETURN QUERY
  SELECT 
    pgp_sym_decrypt(decode(secret_key_encrypted, 'base64'), v_encryption_key) as secret_key,
    pgp_sym_decrypt(decode(webhook_token_encrypted, 'base64'), v_encryption_key) as webhook_token,
    environment as env
  FROM integrations
  WHERE provider = 'asaas'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke from public/anon/authenticated, grant only to service_role
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM anon;
REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO service_role;

-- Enable RLS on payments table if not already enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Service role can do everything on payments" ON payments;

-- Policy: Users can view their own payments
CREATE POLICY "Users can view their own payments" 
ON payments FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Service role can do everything
CREATE POLICY "Service role can do everything on payments" 
ON payments FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
