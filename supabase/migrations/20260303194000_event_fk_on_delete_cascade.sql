-- Ensure event-linked tables cascade on event deletion to avoid FK violations.
DO $$
DECLARE
  fk record;
  base_def text;
  cascade_def text;
BEGIN
  FOR fk IN
    SELECT
      con.oid AS constraint_oid,
      con.conname AS constraint_name,
      nsp.nspname AS schema_name,
      rel.relname AS table_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref.relnamespace
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND ref_nsp.nspname = 'public'
      AND ref.relname = 'events'
      AND rel.relname IN ('check_in_logs', 'event_participants', 'ticket_types', 'payments')
  LOOP
    base_def := pg_get_constraintdef(fk.constraint_oid);

    -- Remove existing ON DELETE clause, then append ON DELETE CASCADE.
    cascade_def := regexp_replace(base_def, '\s+ON\s+DELETE\s+\w+', '', 'gi');
    cascade_def := regexp_replace(cascade_def, '\s+ON\s+UPDATE\s+\w+', '', 'gi');
    cascade_def := cascade_def || ' ON DELETE CASCADE';

    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name,
      cascade_def
    );
  END LOOP;
END $$;
