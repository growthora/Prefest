-- Update RPC function to save Asaas settings including new fields
CREATE OR REPLACE FUNCTION save_admin_settings(
  p_system jsonb,
  p_notifications jsonb,
  p_smtp jsonb,
  p_integrations jsonb
) RETURNS void AS $$
DECLARE
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

REVOKE EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION save_admin_settings(jsonb, jsonb, jsonb, jsonb) TO service_role;
