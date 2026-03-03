-- Lock Asaas integration from admin updates and direct table mutations.
-- Asaas credentials are managed out-of-band and must remain immutable in DB.

-- 1) Ensure Asaas row exists, keep existing values when present, and force production.
INSERT INTO integrations (
  provider,
  is_enabled,
  environment,
  split_enabled,
  platform_fee_type,
  platform_fee_value,
  wallet_id,
  updated_at
)
SELECT
  'asaas',
  true,
  'production',
  false,
  'percentage',
  10,
  NULL,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM integrations WHERE provider = 'asaas'
);

UPDATE integrations
SET environment = 'production', updated_at = now()
WHERE provider = 'asaas';

-- 2) Ignore Asaas in admin RPC saves.
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

-- 3) Hard lock Asaas row against direct changes (INSERT/UPDATE/DELETE).
CREATE OR REPLACE FUNCTION lock_asaas_integration_changes()
RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_asaas_write', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.provider = 'asaas' THEN
      RAISE EXCEPTION 'Asaas integration is locked and cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.provider = 'asaas' THEN
    RAISE EXCEPTION 'Asaas integration is locked and cannot be changed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_asaas_integration_changes ON integrations;
CREATE TRIGGER trg_lock_asaas_integration_changes
BEFORE INSERT OR UPDATE OR DELETE ON integrations
FOR EACH ROW
EXECUTE FUNCTION lock_asaas_integration_changes();

-- 4) Controlled path to rotate fixed Asaas credentials (for deploy/ops only).
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
