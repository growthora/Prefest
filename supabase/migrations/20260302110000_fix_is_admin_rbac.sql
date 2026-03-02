-- Fix is_admin to use roles array (Unified RBAC)
-- This ensures Admin B (with roles=['ADMIN']) is recognized as admin
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (
      'ADMIN' = ANY(roles) OR -- New Standard (Unified RBAC)
      role = 'admin'          -- Backward Compatibility
    )
  );
END;
$function$;

-- Add security check to save_admin_settings
-- This function is SECURITY DEFINER, so we MUST check permissions manually
CREATE OR REPLACE FUNCTION public.save_admin_settings(p_system jsonb, p_notifications jsonb, p_smtp jsonb, p_integrations jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_encryption_key text := 'prefrest_production_secure_key_v1_20260301';
  integration_item jsonb;
BEGIN
  -- Explicit Admin Check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can save settings.';
  END IF;

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
     -- IMPORTANT: We update based on PROVIDER, not ID, ensuring global config update.
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
$function$;
