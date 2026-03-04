-- Add explicit account type and normalize legacy role values for admin user management.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_type text;

-- Keep role constrained to admin/user only for new writes.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'user')) NOT VALID;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_account_type_check
CHECK (account_type IN ('comprador', 'organizador', 'comprador_organizador')) NOT VALID;
