ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender_identity text;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_gender_identity_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_gender_identity_check
CHECK (
  gender_identity IS NULL OR gender_identity IN (
    'homem_cis',
    'mulher_cis',
    'homem_trans',
    'mulher_trans',
    'nao_binario',
    'genero_fluido',
    'agenero',
    'outro',
    'prefiro_nao_informar'
  )
);
