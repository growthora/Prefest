ALTER TABLE public.organizer_asaas_accounts
  ADD COLUMN IF NOT EXISTS asaas_wallet_id text;

-- Backfill safe for external wallet rows.
UPDATE public.organizer_asaas_accounts
SET asaas_wallet_id = external_wallet_id
WHERE payment_method_type = 'EXTERNAL_WALLET'
  AND external_wallet_id IS NOT NULL
  AND coalesce(asaas_wallet_id, '') = '';

CREATE OR REPLACE FUNCTION public.resolve_organizer_destination_wallet(
  p_payment_method_type text,
  p_subaccount_id text,
  p_external_wallet_id text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_payment_method_type = 'EXTERNAL_WALLET' THEN nullif(trim(coalesce(p_external_wallet_id, '')), '')
    ELSE nullif(trim(coalesce(p_subaccount_id, '')), '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_wallet_change_with_active_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_wallet text;
  v_new_wallet text;
  v_has_active_events boolean;
BEGIN
  v_old_wallet := public.resolve_organizer_destination_wallet(
    OLD.payment_method_type,
    coalesce(OLD.asaas_wallet_id, OLD.asaas_account_id),
    OLD.external_wallet_id
  );
  v_new_wallet := public.resolve_organizer_destination_wallet(
    NEW.payment_method_type,
    coalesce(NEW.asaas_wallet_id, NEW.asaas_account_id),
    NEW.external_wallet_id
  );

  IF coalesce(v_old_wallet, '') = coalesce(v_new_wallet, '')
     AND coalesce(OLD.payment_method_type, '') = coalesce(NEW.payment_method_type, '') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.creator_id = NEW.organizer_user_id
      AND coalesce(e.is_active, true) = true
      AND e.status = 'published'
  )
  INTO v_has_active_events;

  IF v_has_active_events THEN
    RAISE EXCEPTION 'ORGANIZER_WALLET_CHANGE_BLOCKED_ACTIVE_EVENTS'
      USING DETAIL = 'Não é permitido alterar wallet com eventos ativos publicados.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_wallet_change_with_active_events ON public.organizer_asaas_accounts;
CREATE TRIGGER trg_prevent_wallet_change_with_active_events
BEFORE UPDATE OF payment_method_type, asaas_account_id, asaas_wallet_id, external_wallet_id
ON public.organizer_asaas_accounts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_wallet_change_with_active_events();

CREATE OR REPLACE FUNCTION public.log_organizer_wallet_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_wallet text;
  v_new_wallet text;
BEGIN
  v_old_wallet := public.resolve_organizer_destination_wallet(
    OLD.payment_method_type,
    coalesce(OLD.asaas_wallet_id, OLD.asaas_account_id),
    OLD.external_wallet_id
  );
  v_new_wallet := public.resolve_organizer_destination_wallet(
    NEW.payment_method_type,
    coalesce(NEW.asaas_wallet_id, NEW.asaas_account_id),
    NEW.external_wallet_id
  );

  IF coalesce(v_old_wallet, '') <> coalesce(v_new_wallet, '')
     OR coalesce(OLD.payment_method_type, '') <> coalesce(NEW.payment_method_type, '') THEN
    INSERT INTO public.organizer_wallet_logs (
      organizer_user_id,
      old_wallet_id,
      new_wallet_id,
      old_payment_method_type,
      new_payment_method_type,
      changed_by
    ) VALUES (
      NEW.organizer_user_id,
      v_old_wallet,
      v_new_wallet,
      OLD.payment_method_type,
      NEW.payment_method_type,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_organizer_wallet_changes ON public.organizer_asaas_accounts;
CREATE TRIGGER trg_log_organizer_wallet_changes
AFTER UPDATE OF payment_method_type, asaas_account_id, asaas_wallet_id, external_wallet_id
ON public.organizer_asaas_accounts
FOR EACH ROW
EXECUTE FUNCTION public.log_organizer_wallet_changes();

CREATE OR REPLACE FUNCTION public.enforce_valid_asaas_for_event_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.organizer_asaas_accounts%ROWTYPE;
  v_platform_wallet text;
  v_destination_wallet text;
BEGIN
  IF NEW.creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_user(NEW.creator_id) THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_account
  FROM public.organizer_asaas_accounts
  WHERE organizer_user_id = NEW.creator_id
  LIMIT 1;

  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_REQUIRED'
      USING DETAIL = 'Conecte e aprove sua conta Asaas antes de criar evento.';
  END IF;

  IF COALESCE(v_account.is_active, false) = false
     OR lower(COALESCE(v_account.kyc_status, '')) <> 'approved' THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_NOT_APPROVED'
      USING DETAIL = 'A conta Asaas do organizador precisa estar ativa e aprovada.';
  END IF;

  v_destination_wallet := public.resolve_organizer_destination_wallet(
    v_account.payment_method_type,
    coalesce(v_account.asaas_wallet_id, v_account.asaas_account_id),
    v_account.external_wallet_id
  );

  IF v_destination_wallet IS NULL THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_MISSING_DESTINATION_WALLET'
      USING DETAIL = 'Configure primeiro seu método de recebimento Asaas.';
  END IF;

  IF v_account.payment_method_type = 'EXTERNAL_WALLET'
     AND nullif(trim(coalesce(v_account.external_wallet_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_MISSING_EXTERNAL_EMAIL'
      USING DETAIL = 'Informe o e-mail da conta Asaas externa.';
  END IF;

  SELECT i.wallet_id
    INTO v_platform_wallet
  FROM public.integrations i
  WHERE i.provider = 'asaas'
  LIMIT 1;

  IF v_platform_wallet IS NOT NULL
     AND v_destination_wallet = v_platform_wallet THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_INVALID_WALLET'
      USING DETAIL = 'A conta do organizador está vinculada ao wallet da plataforma.';
  END IF;

  RETURN NEW;
END;
$$;
