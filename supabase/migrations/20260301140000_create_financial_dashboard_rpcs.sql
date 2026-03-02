-- Helper to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Financial Overview RPC
CREATE OR REPLACE FUNCTION public.get_financial_overview()
RETURNS JSONB AS $$
DECLARE
  v_total_sales NUMERIC;
  v_platform_fees NUMERIC;
  v_organizer_splits NUMERIC;
  v_pending_balance NUMERIC;
  v_daily_sales JSONB;
  v_top_organizers JSONB;
BEGIN
  -- Check Admin Access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  -- 1. Total Sales (Paid/Received payments)
  SELECT COALESCE(SUM(value), 0)
  INTO v_total_sales
  FROM public.payments
  WHERE status IN ('paid', 'received', 'confirmed');

  -- 2. Platform Fees
  -- Calculated as Total Sales - Organizer Splits
  -- We assume payment_splits records the organizer's share
  SELECT COALESCE(SUM(value), 0)
  INTO v_organizer_splits
  FROM public.payment_splits
  WHERE status IN ('paid', 'received', 'confirmed', 'done');
  
  -- If splits are not yet 'paid' but the main payment is 'paid', we should still count them?
  -- Usually split status follows payment status or is handled separately.
  -- For overview, let's stick to paid/received.
  
  v_platform_fees := v_total_sales - v_organizer_splits;
  
  -- 3. Pending Balance (Pending payments)
  SELECT COALESCE(SUM(value), 0)
  INTO v_pending_balance
  FROM public.payments
  WHERE status = 'pending';

  -- 4. Daily Sales (Last 30 days)
  SELECT jsonb_agg(daily)
  INTO v_daily_sales
  FROM (
    SELECT 
      DATE(created_at) as date,
      SUM(value) as total
    FROM public.payments
    WHERE status IN ('paid', 'received', 'confirmed')
    AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  ) daily;

  -- 5. Top Organizers
  SELECT jsonb_agg(top)
  INTO v_top_organizers
  FROM (
    SELECT 
      p.full_name as name,
      COUNT(pay.id) as sales_count,
      SUM(pay.value) as total_value
    FROM public.payments pay
    JOIN public.profiles p ON pay.organizer_user_id = p.id
    WHERE pay.status IN ('paid', 'received', 'confirmed')
    GROUP BY p.full_name
    ORDER BY total_value DESC
    LIMIT 5
  ) top;

  RETURN jsonb_build_object(
    'total_sales', v_total_sales,
    'platform_fees', v_platform_fees,
    'organizer_splits', v_organizer_splits,
    'pending_balance', v_pending_balance,
    'daily_sales', COALESCE(v_daily_sales, '[]'::jsonb),
    'top_organizers', COALESCE(v_top_organizers, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Payments List RPC
CREATE OR REPLACE FUNCTION public.get_admin_payments(
  page INTEGER DEFAULT 1,
  page_size INTEGER DEFAULT 20,
  status_filter TEXT DEFAULT NULL,
  date_start TEXT DEFAULT NULL,
  date_end TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_offset INTEGER;
  v_total_count INTEGER;
  v_payments JSONB;
BEGIN
  -- Check Admin Access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  v_offset := (page - 1) * page_size;

  -- Count total
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.payments
  WHERE (status_filter IS NULL OR status_filter = 'all' OR status = status_filter)
  AND (date_start IS NULL OR created_at >= date_start::timestamp)
  AND (date_end IS NULL OR created_at <= date_end::timestamp);

  -- Get Data
  SELECT jsonb_agg(p)
  INTO v_payments
  FROM (
    SELECT 
      pay.id,
      pay.external_payment_id,
      pay.status,
      pay.value,
      pay.created_at,
      pay.payment_method,
      buyer.full_name as buyer_name,
      buyer.email as buyer_email,
      organizer.full_name as organizer_name,
      e.title as event_title
    FROM public.payments pay
    LEFT JOIN public.profiles buyer ON pay.user_id = buyer.id
    LEFT JOIN public.profiles organizer ON pay.organizer_user_id = organizer.id
    LEFT JOIN public.tickets t ON pay.ticket_id = t.id
    LEFT JOIN public.events e ON t.event_id = e.id
    WHERE (status_filter IS NULL OR status_filter = 'all' OR pay.status = status_filter)
    AND (date_start IS NULL OR pay.created_at >= date_start::timestamp)
    AND (date_end IS NULL OR pay.created_at <= date_end::timestamp)
    ORDER BY pay.created_at DESC
    LIMIT page_size
    OFFSET v_offset
  ) p;

  RETURN jsonb_build_object(
    'data', COALESCE(v_payments, '[]'::jsonb),
    'total', v_total_count,
    'page', page,
    'page_size', page_size
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_financial_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_overview() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_admin_payments(INTEGER, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payments(INTEGER, INTEGER, TEXT, TEXT, TEXT) TO service_role;
