-- VERIFICAR SE AS COLUNAS EXISTEM
-- Execute este SQL primeiro para verificar se as colunas foram criadas

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('state', 'city', 'location')
ORDER BY column_name;

-- Se não retornar as colunas state e city, execute o script abaixo:
-- (Copie do arquivo add_location_fields.sql)
