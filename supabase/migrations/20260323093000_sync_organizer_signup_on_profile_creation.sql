-- Ensure organizer signup intent is stored when the profile is created from auth.users.
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
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_username := public.generate_unique_username(v_full_name);
  v_is_organizer := COALESCE((NEW.raw_user_meta_data->>'is_organizer')::boolean, false);

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
