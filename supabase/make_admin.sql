-- Transformar usuário em administrador
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'nandopirichowski@gmail.com';

-- Verificar se a atualização funcionou
SELECT id, email, full_name, role, created_at 
FROM profiles 
WHERE email = 'nandopirichowski@gmail.com';
