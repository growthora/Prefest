-- Migration to replace mocked encryption key with a secure production key
-- This migration re-encrypts existing data to ensure continuity

DO $$
DECLARE
    -- Old key (mocked)
    v_old_key text := 'super_secret_encryption_key_123';
    -- New key (secure)
    v_new_key text := 'prefrest_production_secure_key_v1_20260301';
    
    r_integration record;
    r_smtp record;
    v_decrypted text;
BEGIN
    -- 1. Re-encrypt Integrations Table
    FOR r_integration IN SELECT * FROM integrations LOOP
        -- Re-encrypt secret_key_encrypted if exists
        IF r_integration.secret_key_encrypted IS NOT NULL THEN
            BEGIN
                -- Decrypt with old key (stored as base64 text)
                v_decrypted := pgp_sym_decrypt(decode(r_integration.secret_key_encrypted, 'base64'), v_old_key);
                -- Encrypt with new key
                UPDATE integrations 
                SET secret_key_encrypted = encode(pgp_sym_encrypt(v_decrypted, v_new_key), 'base64')
                WHERE id = r_integration.id;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to re-encrypt integration secret_key for ID %: %', r_integration.id, SQLERRM;
            END;
        END IF;

        -- Re-encrypt webhook_token_encrypted if exists
        IF r_integration.webhook_token_encrypted IS NOT NULL THEN
            BEGIN
                -- Decrypt with old key (stored as base64 text)
                v_decrypted := pgp_sym_decrypt(decode(r_integration.webhook_token_encrypted, 'base64'), v_old_key);
                -- Encrypt with new key
                UPDATE integrations 
                SET webhook_token_encrypted = encode(pgp_sym_encrypt(v_decrypted, v_new_key), 'base64')
                WHERE id = r_integration.id;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to re-encrypt integration webhook_token for ID %: %', r_integration.id, SQLERRM;
            END;
        END IF;
    END LOOP;

    -- 2. Re-encrypt SMTP Settings Table
    FOR r_smtp IN SELECT * FROM smtp_settings LOOP
        IF r_smtp.password_encrypted IS NOT NULL THEN
            BEGIN
                -- Decrypt with old key (stored as bytea directly)
                -- Note: password_encrypted column is assumed to be bytea based on previous migrations
                v_decrypted := pgp_sym_decrypt(r_smtp.password_encrypted, v_old_key);
                
                -- Encrypt with new key
                UPDATE smtp_settings 
                SET password_encrypted = pgp_sym_encrypt(v_decrypted, v_new_key)
                WHERE id = r_smtp.id;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Failed to re-encrypt smtp password for ID %: %', r_smtp.id, SQLERRM;
            END;
        END IF;
    END LOOP;

END $$;

-- 3. Update get_decrypted_asaas_config function with new key
CREATE OR REPLACE FUNCTION get_decrypted_asaas_config()
RETURNS TABLE (
  secret_key text,
  webhook_token text,
  env text,
  wallet_id text,
  split_enabled boolean,
  platform_fee_type text,
  platform_fee_value numeric,
  api_key text -- Alias for secret_key for compatibility
) AS $$
DECLARE
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
BEGIN
  RETURN QUERY
  SELECT 
    pgp_sym_decrypt(decode(integrations.secret_key_encrypted, 'base64'), v_encryption_key) as secret_key,
    pgp_sym_decrypt(decode(integrations.webhook_token_encrypted, 'base64'), v_encryption_key) as webhook_token,
    integrations.environment as env,
    integrations.wallet_id,
    integrations.split_enabled,
    integrations.platform_fee_type,
    integrations.platform_fee_value,
    pgp_sym_decrypt(decode(integrations.secret_key_encrypted, 'base64'), v_encryption_key) as api_key
  FROM integrations
  WHERE integrations.provider = 'asaas'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update save_admin_settings function with new key
CREATE OR REPLACE FUNCTION save_admin_settings(
  p_system jsonb,
  p_notifications jsonb,
  p_smtp jsonb,
  p_integrations jsonb
) RETURNS void AS $$
DECLARE
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
  integration_item jsonb;
BEGIN
  -- Update System Settings
  UPDATE system_settings
  SET
    theme_mode = p_system->>'theme_mode',
    primary_color = p_system->>'primary_color',
    logo_url = p_system->>'logo_url',
    favicon_url = p_system->>'favicon_url',
    password_policy = p_system->>'password_policy',
    require_2fa_admin = (p_system->>'require_2fa_admin')::boolean,
    login_monitoring = (p_system->>'login_monitoring')::boolean,
    updated_at = now();

  -- Update Notification Settings
  UPDATE notification_settings
  SET
    notify_new_sales = (p_notifications->>'notify_new_sales')::boolean,
    notify_new_users = (p_notifications->>'notify_new_users')::boolean,
    notify_system_errors = (p_notifications->>'notify_system_errors')::boolean,
    email_enabled = (p_notifications->>'email_enabled')::boolean,
    updated_at = now();

  -- Update SMTP Settings
  UPDATE smtp_settings
  SET
    host = p_smtp->>'host',
    port = (p_smtp->>'port')::int,
    secure = (p_smtp->>'secure')::boolean,
    username = p_smtp->>'username',
    from_email = p_smtp->>'from_email',
    updated_at = now();
  
  -- Handle SMTP Password if provided
  IF p_smtp->>'pass' IS NOT NULL AND length(p_smtp->>'pass') > 0 THEN
    UPDATE smtp_settings
    SET password_encrypted = pgp_sym_encrypt(p_smtp->>'pass', v_encryption_key);
  END IF;

  -- Update Integrations
  FOR integration_item IN SELECT * FROM jsonb_array_elements(p_integrations)
  LOOP
     -- Update basic fields
     UPDATE integrations
     SET
       is_enabled = (integration_item->>'is_enabled')::boolean,
       public_key = integration_item->>'public_key',
       environment = integration_item->>'environment',
       wallet_id = integration_item->>'wallet_id',
       split_enabled = (integration_item->>'split_enabled')::boolean,
       platform_fee_type = integration_item->>'platform_fee_type',
       platform_fee_value = (integration_item->>'platform_fee_value')::numeric,
       updated_at = now()
     WHERE provider = integration_item->>'provider';
     
     -- Handle Secret Key if provided
     IF integration_item->>'secret_key' IS NOT NULL AND length(integration_item->>'secret_key') > 0 THEN
        UPDATE integrations
        SET secret_key_encrypted = encode(pgp_sym_encrypt(integration_item->>'secret_key', v_encryption_key), 'base64')
        WHERE provider = integration_item->>'provider';
     END IF;

     -- Handle Webhook Token if provided
     IF integration_item->>'webhook_token' IS NOT NULL AND length(integration_item->>'webhook_token') > 0 THEN
        UPDATE integrations
        SET webhook_token_encrypted = encode(pgp_sym_encrypt(integration_item->>'webhook_token', v_encryption_key), 'base64')
        WHERE provider = integration_item->>'provider';
     END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
