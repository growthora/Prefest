CREATE OR REPLACE FUNCTION public.get_admin_financial_overview(
  date_start timestamptz DEFAULT NULL,
  date_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_is_admin boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role = 'admin'
        OR p.roles @> ARRAY['admin']
        OR p.roles @> ARRAY['ADMIN']
      )
  )
  INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  IF date_start IS NULL THEN
    date_start := '1970-01-01'::timestamptz;
  END IF;

  IF date_end IS NULL THEN
    date_end := now();
  END IF;

  RETURN (
    WITH paid_payments AS (
      SELECT p.*
      FROM public.payments p
      WHERE p.status IN ('paid', 'received', 'confirmed', 'PAID', 'RECEIVED', 'CONFIRMED')
        AND p.created_at BETWEEN date_start AND date_end
    ),
    payment_financials AS (
      SELECT
        p.id,
        p.organizer_user_id,
        p.created_at,
        COALESCE(p.value, 0)::numeric AS gross_value,
        LEAST(
          COALESCE(p.value, 0)::numeric,
          GREATEST(
            COALESCE(
              NULLIF(split.organizer_split, 0),
              GREATEST(
                (COALESCE(t.unit_price, 0) * COALESCE(t.quantity, 1)) - COALESCE(t.discount_amount, 0),
                0
              )
            )::numeric,
            0
          )
        )::numeric AS organizer_value
      FROM paid_payments p
      LEFT JOIN public.tickets t ON t.id = p.ticket_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          CASE
            WHEN COALESCE(ps.recipient_type, '') = 'organizer'
              AND COALESCE(ps.status, 'pending') NOT IN ('refunded', 'cancelled', 'canceled')
            THEN
              CASE
                WHEN LOWER(COALESCE(ps.fee_type, '')) = 'percentage'
                  AND COALESCE(ps.fee_value, 0) > 0
                THEN ROUND((COALESCE(p.asaas_net_value, p.value, 0) * ps.fee_value) / 100.0, 2)
                WHEN COALESCE(ps.value, 0) > 0
                THEN LEAST(COALESCE(ps.value, 0), COALESCE(p.value, 0))
                ELSE 0
              END
            ELSE 0
          END
        ), 0)::numeric AS organizer_split
        FROM public.payment_splits ps
        WHERE ps.payment_id = p.id
      ) split ON true
    ),
    totals AS (
      SELECT
        COALESCE(SUM(gross_value), 0)::numeric AS total_gross_sales,
        COALESCE(SUM(organizer_value), 0)::numeric AS organizer_revenue,
        COALESCE(SUM(GREATEST(gross_value - organizer_value, 0)), 0)::numeric AS total_service_fees,
        COALESCE(SUM(GREATEST(gross_value - organizer_value, 0)), 0)::numeric AS platform_profit
      FROM payment_financials
    ),
    pending_refund AS (
      SELECT
        COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.value ELSE 0 END), 0)::numeric AS pending_balance,
        COALESCE(SUM(CASE WHEN p.status = 'refunded' THEN p.value ELSE 0 END), 0)::numeric AS total_refunded
      FROM public.payments p
      WHERE p.created_at BETWEEN date_start AND date_end
    ),
    daily AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'date', d.day,
            'total', d.total
          )
          ORDER BY d.day
        ),
        '[]'::jsonb
      ) AS daily_sales
      FROM (
        SELECT
          date_trunc('day', pf.created_at) AS day,
          SUM(pf.gross_value)::numeric AS total
        FROM payment_financials pf
        GROUP BY date_trunc('day', pf.created_at)
      ) d
    ),
    top_org AS (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', x.name,
            'sales_count', x.sales_count,
            'total_value', x.total_value
          )
          ORDER BY x.total_value DESC
        ),
        '[]'::jsonb
      ) AS top_organizers
      FROM (
        SELECT
          COALESCE(pr.full_name, 'Organizador') AS name,
          COUNT(*)::int AS sales_count,
          SUM(pf.organizer_value)::numeric AS total_value
        FROM payment_financials pf
        LEFT JOIN public.profiles pr ON pr.id = pf.organizer_user_id
        GROUP BY COALESCE(pr.full_name, 'Organizador')
        ORDER BY SUM(pf.organizer_value) DESC
        LIMIT 5
      ) x
    )
    SELECT jsonb_build_object(
      'total_gross_sales', t.total_gross_sales,
      'total_service_fees', t.total_service_fees,
      'platform_profit', t.platform_profit,
      'platform_margin_percent', CASE
        WHEN t.total_gross_sales > 0 THEN ROUND((t.total_service_fees / t.total_gross_sales) * 100, 2)
        ELSE 0
      END,
      'organizer_revenue', t.organizer_revenue,
      'organizer_splits', t.organizer_revenue,
      'pending_balance', pr.pending_balance,
      'total_refunded', pr.total_refunded,
      'daily_sales', d.daily_sales,
      'top_organizers', to2.top_organizers
    )
    FROM totals t
    CROSS JOIN pending_refund pr
    CROSS JOIN daily d
    CROSS JOIN top_org to2
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_financial_overview(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_financial_overview(timestamptz, timestamptz) TO service_role;

