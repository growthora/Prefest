-- Force reconnection for conflicting organizer Asaas account mapping.
-- Target user: nandopirichowski@gmail.com

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
    INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = 'nandopirichowski@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User nandopirichowski@gmail.com not found in profiles.';
    RETURN;
  END IF;

  DELETE FROM public.organizer_asaas_accounts
  WHERE organizer_user_id = v_user_id;

  RAISE NOTICE 'Asaas link removed for user %, reconnection required.', v_user_id;
END $$;
