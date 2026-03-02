-- Função para validar se evento pode receber compras
CREATE OR REPLACE FUNCTION check_event_purchase_availability(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event events%ROWTYPE;
BEGIN
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Evento não encontrado';
    END IF;

    -- Regra 1: Status Realizado
    IF v_event.status = 'realizado' THEN
        RAISE EXCEPTION 'Evento já realizado. Vendas encerradas.';
    END IF;

    -- Regra 2: Sales Disabled (sales_enabled = false)
    IF v_event.sales_enabled = false THEN
        RAISE EXCEPTION 'Vendas encerradas para este evento.';
    END IF;

    -- Regra 3: Data (end_at + 1 dia)
    -- Consideramos evento realizado 24h após o término
    IF v_event.end_at IS NOT NULL AND NOW() > (v_event.end_at + INTERVAL '1 day') THEN
        RAISE EXCEPTION 'Evento expirado. Vendas encerradas.';
    END IF;

    RETURN TRUE;
END;
$$;

-- Função para atualizar eventos expirados (para ser usada em Cron Job)
CREATE OR REPLACE FUNCTION update_expired_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE events
    SET 
        status = 'realizado',
        sales_enabled = false
    WHERE 
        status != 'realizado'
        AND end_at IS NOT NULL
        AND NOW() > (end_at + INTERVAL '1 day');
END;
$$;
