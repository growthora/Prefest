DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_types_min_paid_price_check'
  ) THEN
    ALTER TABLE public.ticket_types
      ADD CONSTRAINT ticket_types_min_paid_price_check
      CHECK (price = 0 OR price >= 5) NOT VALID;
  END IF;
END $$;

