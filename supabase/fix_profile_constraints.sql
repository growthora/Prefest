-- Fix constraints for profile enums to match UI options

-- 1. match_intention
-- UI values: 'paquera', 'amizade', 'networking', 'casual', 'serio'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_match_intention_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_match_intention_check 
CHECK (match_intention IN ('paquera', 'amizade', 'networking', 'casual', 'serio'));

-- 2. relationship_status
-- UI values: 'solteiro', 'casado', 'namorando', 'divorciado', 'viuvo', 'enrolado', 'relacionamento_aberto'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_relationship_status_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_relationship_status_check 
CHECK (relationship_status IN ('solteiro', 'casado', 'namorando', 'divorciado', 'viuvo', 'enrolado', 'relacionamento_aberto'));
