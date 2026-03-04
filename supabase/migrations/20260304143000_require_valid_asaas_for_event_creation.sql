-- Enforce mandatory and valid Asaas organizer account before event creation.
-- Rules:
-- 1) Non-admin creators must have organizer_asaas_accounts row.
-- 2) Account must be active and approved.
-- 3) Organizer wallet cannot be the platform wallet.

CREATE OR REPLACE FUNCTION public.enforce_valid_asaas_for_event_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.organizer_asaas_accounts%ROWTYPE;
  v_platform_wallet text;
BEGIN
  IF NEW.creator_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin can still create events without organizer account checks.
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

  SELECT i.wallet_id
    INTO v_platform_wallet
  FROM public.integrations i
  WHERE i.provider = 'asaas'
  LIMIT 1;

  IF v_platform_wallet IS NOT NULL
     AND v_account.asaas_account_id IS NOT NULL
     AND v_account.asaas_account_id = v_platform_wallet THEN
    RAISE EXCEPTION 'ORGANIZER_ASAAS_INVALID_WALLET'
      USING DETAIL = 'A conta do organizador está vinculada ao wallet da plataforma.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_valid_asaas_for_event_creation ON public.events;

CREATE TRIGGER trg_enforce_valid_asaas_for_event_creation
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_valid_asaas_for_event_creation();

