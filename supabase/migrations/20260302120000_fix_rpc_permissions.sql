GRANT EXECUTE ON FUNCTION get_decrypted_asaas_config() TO service_role;
GRANT EXECUTE ON FUNCTION get_public_asaas_config() TO anon, authenticated, service_role;
