-- Ensure encryption calls resolve in all execution contexts by qualifying pgcrypto schema.

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

  UPDATE notification_settings
  SET
    notify_new_sales = (p_notifications->>'notify_new_sales')::boolean,
    notify_new_users = (p_notifications->>'notify_new_users')::boolean,
    notify_system_errors = (p_notifications->>'notify_system_errors')::boolean,
    email_enabled = (p_notifications->>'email_enabled')::boolean,
    updated_at = now();

  UPDATE smtp_settings
  SET
    host = p_smtp->>'host',
    port = (p_smtp->>'port')::int,
    secure = (p_smtp->>'secure')::boolean,
    username = p_smtp->>'username',
    from_email = p_smtp->>'from_email',
    updated_at = now();

  IF p_smtp->>'pass' IS NOT NULL AND length(p_smtp->>'pass') > 0 THEN
    UPDATE smtp_settings
    SET password_encrypted = extensions.pgp_sym_encrypt(p_smtp->>'pass', v_encryption_key);
  END IF;

  FOR integration_item IN SELECT * FROM jsonb_array_elements(p_integrations)
  LOOP
    IF integration_item->>'provider' = 'asaas' THEN
      CONTINUE;
    END IF;

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

    IF integration_item->>'secret_key' IS NOT NULL AND length(integration_item->>'secret_key') > 0 THEN
      UPDATE integrations
      SET secret_key_encrypted = encode(extensions.pgp_sym_encrypt(integration_item->>'secret_key', v_encryption_key), 'base64')
      WHERE provider = integration_item->>'provider';
    END IF;

    IF integration_item->>'webhook_token' IS NOT NULL AND length(integration_item->>'webhook_token') > 0 THEN
      UPDATE integrations
      SET webhook_token_encrypted = encode(extensions.pgp_sym_encrypt(integration_item->>'webhook_token', v_encryption_key), 'base64')
      WHERE provider = integration_item->>'provider';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_locked_asaas_credentials(
  p_api_key text,
  p_webhook_token text
) RETURNS void AS $$
DECLARE
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
BEGIN
  IF p_api_key IS NULL OR length(trim(p_api_key)) = 0 THEN
    RAISE EXCEPTION 'API key is required';
  END IF;

  IF p_webhook_token IS NULL OR length(trim(p_webhook_token)) = 0 THEN
    RAISE EXCEPTION 'Webhook token is required';
  END IF;

  PERFORM set_config('app.allow_asaas_write', '1', true);

  UPDATE integrations
  SET
    environment = 'production',
    secret_key_encrypted = encode(extensions.pgp_sym_encrypt(trim(p_api_key), v_encryption_key), 'base64'),
    webhook_token_encrypted = encode(extensions.pgp_sym_encrypt(trim(p_webhook_token), v_encryption_key), 'base64'),
    updated_at = now()
  WHERE provider = 'asaas';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION set_locked_asaas_credentials(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_locked_asaas_credentials(text, text) FROM anon;
REVOKE ALL ON FUNCTION set_locked_asaas_credentials(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION set_locked_asaas_credentials(text, text) TO service_role;
