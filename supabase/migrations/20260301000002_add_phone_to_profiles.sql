-- Add phone column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update trigger to capture phone from metadata if available (future proofing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cpf, birth_date, phone, roles)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'cpf',
    (NEW.raw_user_meta_data->>'birth_date')::date,
    NEW.raw_user_meta_data->>'phone',
    ARRAY['BUYER']
  );
  RETURN NEW;
END;
$function$;
