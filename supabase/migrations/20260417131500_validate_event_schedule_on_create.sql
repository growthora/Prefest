CREATE OR REPLACE FUNCTION public.validate_event_schedule_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_date IS NULL THEN
    RAISE EXCEPTION 'EVENT_DATE_REQUIRED'
      USING DETAIL = 'A data de início do evento é obrigatória.';
  END IF;

  IF NEW.event_date < date_trunc('minute', now()) THEN
    RAISE EXCEPTION 'EVENT_DATE_IN_PAST'
      USING DETAIL = 'A data de início deve ser no presente ou no futuro.';
  END IF;

  IF NEW.end_at IS NOT NULL AND NEW.end_at < NEW.event_date THEN
    RAISE EXCEPTION 'EVENT_END_BEFORE_START'
      USING DETAIL = 'A data de término deve ser maior ou igual à data de início.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_schedule_on_create ON public.events;

CREATE TRIGGER trg_validate_event_schedule_on_create
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_schedule_on_create();
