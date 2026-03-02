
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"
import { requireRole } from "../_shared/requireRole.ts"

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    console.log(`[admin-financial-dashboard] Request received: ${req.method} ${req.url}`);

    // 1. Authenticate & Authorize
    const { user, supabase: supabaseUser } = await requireAuth(req);
    
    // 2. Check Role (Admin Only)
    await requireRole(supabaseUser, user.id, ['ADMIN']);

    console.log(`[admin-financial-dashboard] User authenticated & authorized: ${user.id}`);

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

        // Initialize Service Role Client for sensitive ops (Asaas Config Access)
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
        const baseUrl = env === 'production' ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';

        // 3. Call Asaas
        const asaasRes = await fetch(`${baseUrl}/payments/${payment.external_payment_id}`, {
            headers: { 'access_token': apiKey }
        });
        
        if (!asaasRes.ok) {
            const errText = await asaasRes.text();
            throw new Error(`Asaas API Error: ${errText}`);
        }
        
        const asaasData = await asaasRes.json();
        
        // 4. Update local payment status if different
        if (asaasData.status && asaasData.status !== payment.status) {
            const { error: updateError } = await serviceClient
                .from('payments')
                .update({ 
                    status: asaasData.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', paymentId);
            
            if (updateError) throw updateError;
            result = { reconciled: true, oldStatus: payment.status, newStatus: asaasData.status };
        } else {
            result = { reconciled: true, status: payment.status, message: 'Status already up to date' };
        }
    } else {
      throw new Error('Invalid type parameter')
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error(`[admin-financial-dashboard] Error:`, error);
    
    if (error instanceof Response) {
      return error;
    }

    // Return specific status codes based on error type if possible, or 400/500
    const status = error.message?.includes('Unauthorized') ? 401 
                 : error.message?.includes('Access denied') ? 403
                 : 400;

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: status
      }
    )
  }
})
