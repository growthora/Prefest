-- 1. Create generate_unique_username function
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_name text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
  new_username text;
  counter integer := 0;
  base_slug text;
BEGIN
  -- Normalize base name to create a slug (lowercase, replace spaces with hyphens, remove special chars)
  base_slug := lower(regexp_replace(base_name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  
  -- Fallback if empty
  IF base_slug IS NULL OR length(base_slug) = 0 THEN
    base_slug := 'user';
  END IF;

  new_username := base_slug;
  
  -- Loop until we find a unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
    counter := counter + 1;
    new_username := base_slug || '-' || counter;
  END LOOP;
  
  RETURN new_username;
END;
$function$;

-- 2. Update handle_new_user to use generate_unique_username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_username text;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'User');
  v_username := public.generate_unique_username(v_full_name);

  INSERT INTO public.profiles (id, email, full_name, cpf, birth_date, phone, roles, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'cpf',
    (NEW.raw_user_meta_data->>'birth_date')::date,
    NEW.raw_user_meta_data->>'phone',
    ARRAY['BUYER'],
    v_username
  );
  RETURN NEW;
END;
$function$;

-- 3. Create get_financial_overview RPC
CREATE OR REPLACE FUNCTION public.get_financial_overview(date_start timestamptz DEFAULT NULL, date_end timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_total_revenue numeric;
  v_total_transactions integer;
  v_success_rate numeric;
  v_revenue_by_method jsonb;
  v_daily_revenue jsonb;
BEGIN
  -- Set defaults if null
  IF date_start IS NULL THEN date_start := '1970-01-01'::timestamptz; END IF;
  IF date_end IS NULL THEN date_end := now(); END IF;

  -- Calculate Total Revenue (paid only)
  SELECT COALESCE(SUM(value), 0)
  INTO v_total_revenue
  FROM payments
  WHERE status = 'paid'
  AND created_at BETWEEN date_start AND date_end;

  -- Calculate Total Transactions (all statuses)
  SELECT COUNT(*)
  INTO v_total_transactions
  FROM payments
  WHERE created_at BETWEEN date_start AND date_end;

  -- Calculate Success Rate
  IF v_total_transactions > 0 THEN
    SELECT (COUNT(*) FILTER (WHERE status = 'paid')::numeric / COUNT(*)::numeric) * 100
    INTO v_success_rate
    FROM payments
    WHERE created_at BETWEEN date_start AND date_end;
  ELSE
    v_success_rate := 0;
  END IF;

  -- Revenue by Method
  SELECT jsonb_object_agg(payment_method, total)
  INTO v_revenue_by_method
  FROM (
    SELECT payment_method, SUM(value) as total
    FROM payments
    WHERE status = 'paid'
    AND created_at BETWEEN date_start AND date_end
    GROUP BY payment_method
  ) t;

  -- Daily Revenue (last 30 days within range for chart)
  SELECT jsonb_agg(jsonb_build_object('date', day, 'value', COALESCE(total, 0)))
  INTO v_daily_revenue
  FROM (
    SELECT date_trunc('day', created_at) as day, SUM(value) as total
    FROM payments
    WHERE status = 'paid'
    AND created_at BETWEEN date_start AND date_end
    GROUP BY 1
    ORDER BY 1
  ) t;

  RETURN jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_transactions', v_total_transactions,
    'success_rate', round(v_success_rate, 2),
    'revenue_by_method', COALESCE(v_revenue_by_method, '{}'::jsonb),
    'daily_revenue', COALESCE(v_daily_revenue, '[]'::jsonb)
  );
END;
$function$;

-- 4. Create get_admin_payments RPC
CREATE OR REPLACE FUNCTION public.get_admin_payments(
  page integer DEFAULT 1,
  page_size integer DEFAULT 20,
  status_filter text DEFAULT NULL,
  date_start timestamptz DEFAULT NULL,
  date_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  external_id text,
  amount numeric,
  status text,
  method text,
  customer_email text,
  customer_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Set defaults
  IF page < 1 THEN page := 1; END IF;
  IF page_size < 1 THEN page_size := 20; END IF;
  IF date_start IS NULL THEN date_start := '1970-01-01'::timestamptz; END IF;
  IF date_end IS NULL THEN date_end := now(); END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.external_payment_id::text,
    p.value as amount,
    p.status::text,
    p.payment_method::text as method,
    prof.email,
    prof.full_name,
    p.created_at
  FROM payments p
  LEFT JOIN profiles prof ON p.user_id = prof.id
  WHERE p.created_at BETWEEN date_start AND date_end
  AND (status_filter IS NULL OR p.status = status_filter)
  ORDER BY p.created_at DESC
  LIMIT page_size
  OFFSET (page - 1) * page_size;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_financial_overview(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_payments(integer, integer, text, timestamptz, timestamptz) TO authenticated, service_role;
