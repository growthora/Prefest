-- Create audit table for role changes
CREATE TABLE IF NOT EXISTS roles_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID REFERENCES profiles(id),
    performed_by UUID REFERENCES profiles(id),
    old_roles TEXT[],
    new_roles TEXT[],
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE roles_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view audit logs (assuming 'ADMIN' in roles)
-- Note: This depends on the roles array structure being established.
CREATE POLICY "Admins can view audit logs" ON roles_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.roles @> ARRAY['ADMIN']
        )
    );

-- Function to ensure roles consistency and log changes
CREATE OR REPLACE FUNCTION ensure_roles_consistency()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Ensure roles is not null. Default to ['BUYER']
  IF NEW.roles IS NULL THEN
    NEW.roles := ARRAY['BUYER'];
  END IF;

  -- 2. Audit logging if roles changed
  IF (TG_OP = 'UPDATE' AND NEW.roles IS DISTINCT FROM OLD.roles) THEN
    INSERT INTO roles_audit_logs (target_user_id, performed_by, old_roles, new_roles)
    VALUES (
      NEW.id,
      auth.uid(), -- The user performing the update
      OLD.roles,
      NEW.roles
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS check_roles_consistency ON profiles;
CREATE TRIGGER check_roles_consistency
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION ensure_roles_consistency();
