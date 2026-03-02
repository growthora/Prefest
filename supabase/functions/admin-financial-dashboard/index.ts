import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { getCorsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  console.log(`[admin-financial-dashboard] Request received: ${req.method} ${req.url}`);
  console.log(`[admin-financial-dashboard] Origin: ${req.headers.get('Origin')}`);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    console.log('[admin-financial-dashboard] Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log(`[admin-financial-dashboard] Auth Header present: ${!!authHeader}`);

    if (!authHeader) {
      console.error('[admin-financial-dashboard] Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Initialize Supabase Client with Service Role Key to validate user manually
    // This avoids issues with global auth context in Edge Runtime
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
      }
    )

    // Initialize User Context Client (for RPC calls that rely on auth.uid())
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify User Token Manually
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    
    if (userError) {
      console.error('[admin-financial-dashboard] Auth Error:', userError);
    }
    if (!user) {
      console.error('[admin-financial-dashboard] No user found in session');
    }

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    console.log(`[admin-financial-dashboard] User authenticated: ${user.id} (${user.email})`);

    // Explicit Admin Check via Direct DB Query (More robust than RPC with Service Role)
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, roles, email')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error('[admin-financial-dashboard] Profile fetch error:', profileError);
    }
    
    if (profile) {
        console.log(`[admin-financial-dashboard] Profile found: Roles=${JSON.stringify(profile.roles)}, Email=${profile.email}`);
        console.log(`[admin-financial-dashboard] Roles type: ${typeof profile.roles}, Is Array: ${Array.isArray(profile.roles)}`);
    } else {
        console.error('[admin-financial-dashboard] No profile found for user ID:', user.id);
    }

    // Robust check for roles (handles array of strings or potential string parsing issues)
    let roles = profile?.roles || [];
    if (typeof roles === 'string') {
        // Fallback for weird edge cases where postgres array returns as string
        try {
            roles = JSON.parse(roles);
        } catch {
            roles = (roles as string).replace(/[{}]/g, '').split(',');
        }
    }

    const hasAdminRole = Array.isArray(roles) && roles.some((r: any) => String(r).trim().toUpperCase() === 'ADMIN');

    if (profileError || !profile || !hasAdminRole) {
         console.warn(`[admin-financial-dashboard] Access denied. User: ${user.email} (${user.id}), Roles found: ${JSON.stringify(roles)}`);
         return new Response(JSON.stringify({ 
            error: 'Forbidden: Admin access required',
            debug: {
                user_id: user.id,
                user_email: user.email,
                profile_roles: roles,
                profile_found: !!profile,
                roles_type: typeof profile?.roles
            }
         }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
         })
    }

    // Parse URL params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') // 'overview' | 'payments' | 'reconcile'

    let result;

    if (type === 'overview') {
      // Call RPC for overview with date filters
      const dateStartParam = url.searchParams.get('dateStart')
      const dateEndParam = url.searchParams.get('dateEnd')
      
      // Ensure ISO string format for TIMESTAMPTZ
      const dateStart = dateStartParam ? new Date(dateStartParam).toISOString() : null
      const dateEnd = dateEndParam ? new Date(dateEndParam).toISOString() : null
      
      console.log(`[admin-financial-dashboard] Fetching overview. dateStart=${dateStart}, dateEnd=${dateEnd}`);

      const { data, error } = await supabaseUser.rpc('get_financial_overview', {
        date_start: dateStart,
        date_end: dateEnd
      })
      if (error) {
        console.error('[admin-financial-dashboard] RPC Error (get_financial_overview):', error);
        throw error;
      }
      result = data
    } else if (type === 'payments') {
      // Call RPC for payments list
      const page = Number(url.searchParams.get('page')) || 1
      const pageSize = Number(url.searchParams.get('pageSize')) || 20
      const statusFilter = url.searchParams.get('status') || null
      
      const dateStartParam = url.searchParams.get('dateStart')
      const dateEndParam = url.searchParams.get('dateEnd')
      
      // Ensure ISO string format for TIMESTAMPTZ
      const dateStart = dateStartParam ? new Date(dateStartParam).toISOString() : null
      const dateEnd = dateEndParam ? new Date(dateEndParam).toISOString() : null

      const { data, error } = await supabaseUser.rpc('get_admin_payments', {
        page,
        page_size: pageSize,
        status_filter: statusFilter,
        date_start: dateStart,
        date_end: dateEnd
      })
      if (error) throw error
      result = data
    } else if (type === 'reconcile') {
        const paymentId = url.searchParams.get('id');
        if (!paymentId) throw new Error('Payment ID required for reconciliation');

        // Initialize Service Role Client for sensitive ops
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get Payment from DB
        const { data: payment, error: fetchError } = await serviceClient
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();
        
        if (fetchError || !payment) throw new Error('Payment not found');
        if (!payment.external_payment_id) throw new Error('Payment has no external ID');

        // 2. Get Asaas Config
        const { data: config, error: configError } = await serviceClient.rpc('get_decrypted_asaas_config').single();
        if (configError || !config) throw new Error('Failed to load Asaas config');

        const { secret_key, env } = config;
        const apiKey = secret_key;
        const baseUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';

        // 3. Call Asaas
        const asaasRes = await fetch(`${baseUrl}/payments/${payment.external_payment_id}`, {
            headers: { 'access_token': apiKey }
        });
        
        if (!asaasRes.ok) {
            const errText = await asaasRes.text();
            throw new Error(`Asaas API Error: ${errText}`);
        }
        const asaasPayment = await asaasRes.json();

        // 4. Update DB
        const newStatus = asaasPayment.status.toLowerCase(); 
        
        // Map Asaas status to our simplified status
        let dbStatus = newStatus;
        if (['received', 'confirmed', 'received_in_cash'].includes(newStatus)) dbStatus = 'paid';
        if (['refunded', 'refund_requested', 'chargeback_requested', 'chargeback_dispute'].includes(newStatus)) dbStatus = 'refunded';
        
        // Update payments table
        const { error: updateError } = await serviceClient
            .from('payments')
            .update({ 
                status: dbStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', paymentId);

        if (updateError) throw updateError;

        result = { 
            success: true, 
            old_status: payment.status, 
            new_status: dbStatus, 
            asaas_status: newStatus 
        };
    } else {
      throw new Error('Invalid type parameter. Use "overview", "payments", or "reconcile".')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
