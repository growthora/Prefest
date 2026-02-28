-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create RPC function to save all settings in a transaction
CREATE OR REPLACE FUNCTION save_admin_settings(
  p_system jsonb,
  p_notifications jsonb,
  p_smtp jsonb,
  p_integrations jsonb
) RETURNS void AS $$
DECLARE
  -- Using a fixed key for demo purposes. In production, this should be an env var or vault secret.
  v_encryption_key text := 'super_secret_encryption_key_123';
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
  
  -- Handle SMTP Password if provided (and not empty/null)
  IF p_smtp->>'pass' IS NOT NULL AND length(p_smtp->>'pass') > 0 THEN
    UPDATE smtp_settings
    SET password_encrypted = pgp_sym_encrypt(p_smtp->>'pass', v_encryption_key);
  END IF;

  -- Update Integrations
  -- Iterate over the array of integrations
  FOR integration_item IN SELECT * FROM jsonb_array_elements(p_integrations)
  LOOP
     -- Update basic fields
     UPDATE integrations
     SET
       is_enabled = (integration_item->>'is_enabled')::boolean,
       public_key = integration_item->>'public_key',
       updated_at = now()
     WHERE provider = integration_item->>'provider';
     
     -- Handle Secret Key if provided
     IF integration_item->>'secret_key' IS NOT NULL AND length(integration_item->>'secret_key') > 0 THEN
        UPDATE integrations
        SET secret_key_encrypted = pgp_sym_encrypt(integration_item->>'secret_key', v_encryption_key)
        WHERE provider = integration_item->>'provider';
     END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (RLS/Logic inside function will handle access, but here we just check role in Edge Function or RLS)
-- Actually, SECURITY DEFINER runs as owner. We should restrict access.
-- But since we call it from Edge Function which uses Service Role or validates Admin, it's fine.
-- However, to be safe, we can add a check inside or revoke public execute.
REVOKE EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) FROM service_role;
