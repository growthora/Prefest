ALTER TABLE public.user_deletion_logs
ADD COLUMN IF NOT EXISTS deleted_email text,
ADD COLUMN IF NOT EXISTS deleted_email_normalized text,
ADD COLUMN IF NOT EXISTS deleted_cpf text,
ADD COLUMN IF NOT EXISTS deleted_cpf_normalized text;

CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_deleted_email_normalized
ON public.user_deletion_logs (deleted_email_normalized)
WHERE deleted_email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_deleted_cpf_normalized
ON public.user_deletion_logs (deleted_cpf_normalized)
WHERE deleted_cpf_normalized IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_username text;
  v_full_name text;
  v_is_organizer boolean;
  v_roles text[];
  v_organizer_status text;
  v_account_type text;
  v_email_normalized text;
  v_cpf_normalized text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_username := public.generate_unique_username(v_full_name);
  v_is_organizer := COALESCE((NEW.raw_user_meta_data->>'is_organizer')::boolean, false);
  v_email_normalized := NULLIF(lower(trim(COALESCE(NEW.email, ''))), '');
  v_cpf_normalized := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');

  IF EXISTS (
    SELECT 1
    FROM public.user_deletion_logs udl
    WHERE (v_email_normalized IS NOT NULL AND udl.deleted_email_normalized = v_email_normalized)
       OR (v_cpf_normalized IS NOT NULL AND udl.deleted_cpf_normalized = v_cpf_normalized)
  ) THEN
    RAISE EXCEPTION 'DELETED_ACCOUNT_REUSE_BLOCKED';
  END IF;

  v_roles := ARRAY['BUYER'];
  v_organizer_status := 'NONE';
  v_account_type := 'comprador';

  IF v_is_organizer THEN
    v_roles := ARRAY['BUYER', 'ORGANIZER'];
    v_organizer_status := 'PENDING';
    v_account_type := 'comprador_organizador';
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    cpf,
    birth_date,
    phone,
    roles,
    organizer_status,
    account_type,
    username
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'cpf',
    (NEW.raw_user_meta_data->>'birth_date')::date,
    NEW.raw_user_meta_data->>'phone',
    v_roles,
    v_organizer_status,
    v_account_type,
    v_username
  );

  RETURN NEW;
END;
$function$;
