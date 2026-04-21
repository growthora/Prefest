UPDATE public.profiles
SET match_gender_preference = ARRAY['todos']
WHERE match_gender_preference IS NULL
   OR COALESCE(array_length(match_gender_preference, 1), 0) = 0;

CREATE OR REPLACE FUNCTION public.ensure_roles_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.roles IS NULL THEN
    NEW.roles := ARRAY['BUYER'];
  END IF;

  IF NEW.match_gender_preference IS NULL
    OR COALESCE(array_length(NEW.match_gender_preference, 1), 0) = 0 THEN
    NEW.match_gender_preference := ARRAY['todos'];
  END IF;

  IF (TG_OP = 'UPDATE' AND NEW.roles IS DISTINCT FROM OLD.roles) THEN
    INSERT INTO roles_audit_logs (target_user_id, performed_by, old_roles, new_roles)
    VALUES (
      NEW.id,
      auth.uid(),
      OLD.roles,
      NEW.roles
    );
  END IF;

  RETURN NEW;
END;
$function$;
