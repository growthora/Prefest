-- Função para verificar se e-mail ou CPF já existem antes do cadastro
-- Isso evita o erro genérico "Database error saving new user" do trigger

CREATE OR REPLACE FUNCTION public.check_registration_data(check_email text, check_cpf text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_taken boolean;
  cpf_taken boolean;
BEGIN
  -- Verificar se e-mail existe na tabela de perfis
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE email = check_email) INTO email_taken;
  
  -- Verificar se CPF existe na tabela de perfis (se CPF foi fornecido)
  IF check_cpf IS NOT NULL AND check_cpf != '' THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE cpf = check_cpf) INTO cpf_taken;
  ELSE
    cpf_taken := false;
  END IF;
  
  RETURN json_build_object(
    'email_exists', email_taken,
    'cpf_exists', cpf_taken
  );
END;
$$;

-- Permissões para usuários anônimos (necessário para cadastro)
GRANT EXECUTE ON FUNCTION public.check_registration_data(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_registration_data(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_registration_data(text, text) TO service_role;
