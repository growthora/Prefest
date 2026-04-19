CREATE OR REPLACE FUNCTION public.validate_ticket_sale_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_start timestamptz;
  v_event_end timestamptz;
BEGIN
  SELECT e.event_date, COALESCE(e.end_at, e.event_date)
    INTO v_event_start, v_event_end
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF v_event_start IS NULL THEN
    RAISE EXCEPTION 'TICKET_EVENT_NOT_FOUND'
      USING DETAIL = 'Não foi possível validar as datas do lote sem um evento válido.';
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.sale_start_date IS NOT NULL
     AND NEW.sale_start_date < date_trunc('minute', now()) THEN
    RAISE EXCEPTION 'TICKET_SALE_START_IN_PAST'
      USING DETAIL = 'A data de início das vendas deve ser no presente ou no futuro.';
  END IF;

  IF NEW.sale_start_date IS NOT NULL
     AND NEW.sale_end_date IS NOT NULL
     AND NEW.sale_end_date < NEW.sale_start_date THEN
    RAISE EXCEPTION 'TICKET_SALE_END_BEFORE_START'
      USING DETAIL = 'A data de término das vendas deve ser maior ou igual à data de início das vendas.';
  END IF;

  IF NEW.sale_end_date IS NOT NULL
     AND NEW.sale_end_date > v_event_end THEN
    RAISE EXCEPTION 'TICKET_SALE_END_AFTER_EVENT'
      USING DETAIL = 'A data de término das vendas não pode ser depois do fim do evento.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ticket_sale_window ON public.ticket_types;

CREATE TRIGGER trg_validate_ticket_sale_window
BEFORE INSERT OR UPDATE ON public.ticket_types
FOR EACH ROW
EXECUTE FUNCTION public.validate_ticket_sale_window();
