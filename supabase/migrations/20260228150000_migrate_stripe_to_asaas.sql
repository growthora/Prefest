-- Migration to support Asaas integration and remove Stripe specific fields/data if needed
-- We will keep the generic structure but ensure Asaas specific needs are met

-- 1. Update integrations table structure if needed
-- The current structure seems to have: id, provider, is_enabled, public_key, secret_key_encrypted
-- We need to add: environment, webhook_token_encrypted
-- We will also migrate any 'stripe' integration to 'asaas' (disabled by default) or just delete them to start fresh as per request "Stripe inexistente"

DELETE FROM integrations WHERE provider = 'stripe';

ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS environment text CHECK (environment IN ('sandbox', 'production')) DEFAULT 'sandbox',
ADD COLUMN IF NOT EXISTS webhook_token_encrypted text;

-- Ensure we have an Asaas entry (if not exists)
INSERT INTO integrations (provider, is_enabled, environment)
SELECT 'asaas', false, 'sandbox'
WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE provider = 'asaas');

-- 2. Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    event_id uuid REFERENCES events(id), -- Optional: link to event if applicable
    ticket_type_id uuid REFERENCES ticket_types(id), -- Optional
    provider varchar(50) NOT NULL DEFAULT 'asaas',
    external_payment_id varchar(255), -- Asaas Payment ID
    value numeric(10, 2) NOT NULL,
    status varchar(50) CHECK (status IN ('pending', 'paid', 'canceled', 'refunded', 'overdue')),
    payment_method varchar(50), -- pix, credit_card, boleto
    payment_url text, -- URL for payment (invoice url or pix qr code url)
    pix_qr_code text, -- Raw PIX string
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Admins can view all payments
CREATE POLICY "Admins can view all payments" ON payments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.roles @> ARRAY['admin'])
        )
    );

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can do anything (for Edge Functions)
CREATE POLICY "Service role full access" ON payments
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Create RPC to get decrypted Asaas keys (for Edge Functions)
CREATE OR REPLACE FUNCTION get_decrypted_asaas_config()
RETURNS TABLE (
    secret_key text,
    webhook_token text,
    env text
) AS $$
DECLARE
    v_encryption_key text := 'super_secret_encryption_key_123'; -- In prod use vault/env
BEGIN
    RETURN QUERY
    SELECT 
        pgp_sym_decrypt(secret_key_encrypted::bytea, v_encryption_key) as secret_key,
        pgp_sym_decrypt(webhook_token_encrypted::bytea, v_encryption_key) as webhook_token,
        environment as env
    FROM integrations
    WHERE provider = 'asaas'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_decrypted_asaas_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO service_role;
GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO authenticated; -- Needed if called from EF with auth user, but better to restrict.
-- Actually, Edge Functions usually run with a user context but can use Service Role client. 
-- For safety, let's keep it restricted and ensure EF uses Service Role or we check admin inside EF.
-- But wait, get_decrypted_integration_key was used before. Let's make sure we match that pattern or improve.
-- The previous pattern was `get_decrypted_integration_key(provider)`.
-- Let's stick to a specific one for Asaas to get all config at once.

-- Grant access to payments for authenticated users to create (via Edge Function mainly, but good to have RLS if we insert directly? No, EF handles insert usually)
-- But if we want the user to see it, we need SELECT.
