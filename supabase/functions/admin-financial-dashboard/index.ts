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
    // Initialize Supabase Client with User Auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify User is Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Explicit Admin Check via RPC (Double safety for sensitive ops)
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc('is_admin');
    if (adminError || !isAdmin) {
         return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
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
      const dateStart = url.searchParams.get('dateStart') || null
      const dateEnd = url.searchParams.get('dateEnd') || null

      const { data, error } = await supabaseClient.rpc('get_financial_overview', {
        date_start: dateStart,
        date_end: dateEnd
      })
      if (error) throw error
      result = data
    } else if (type === 'payments') {
      // Call RPC for payments list
      const page = Number(url.searchParams.get('page')) || 1
      const pageSize = Number(url.searchParams.get('pageSize')) || 20
      const statusFilter = url.searchParams.get('status') || null
      const dateStart = url.searchParams.get('dateStart') || null
      const dateEnd = url.searchParams.get('dateEnd') || null

      const { data, error } = await supabaseClient.rpc('get_admin_payments', {
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
