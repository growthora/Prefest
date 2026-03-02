-- Migration to synchronize legacy 'role' column with 'roles' array
-- This ensures all current admins maintain access after the switch to roles-only check

-- 1. Ensure roles array is initialized if null
UPDATE profiles 
SET roles = ARRAY['BUYER'] 
WHERE roles IS NULL;

-- 2. Promote legacy 'admin' to have 'ADMIN' role
UPDATE profiles
SET roles = array_append(roles, 'ADMIN')
WHERE role = 'admin' 
AND NOT (roles @> ARRAY['ADMIN']);

-- 3. Promote legacy 'equipe' to have 'FINANCEIRO' role
UPDATE profiles
SET roles = array_append(roles, 'FINANCEIRO')
WHERE role = 'equipe' 
AND NOT (roles @> ARRAY['FINANCEIRO']);

-- 4. Log the migration (optional, purely for verification if needed)
-- SELECT count(*) as migrated_admins FROM profiles WHERE role = 'admin' AND roles @> ARRAY['ADMIN'];
