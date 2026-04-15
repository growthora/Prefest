-- Harden profile fields used by checkout and Asaas payment flows.
-- Some environments drifted without these columns, which causes
-- complete-profile and payment functions to fail with generic errors.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc'::text, now());

UPDATE public.profiles
SET
  created_at = COALESCE(created_at, timezone('utc'::text, now())),
  updated_at = COALESCE(updated_at, timezone('utc'::text, now()))
WHERE created_at IS NULL
   OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_asaas_customer_id
ON public.profiles (asaas_customer_id)
WHERE asaas_customer_id IS NOT NULL;
