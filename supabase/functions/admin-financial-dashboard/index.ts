
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"
import { requireRole } from "../_shared/requireRole.ts"

function normalizeAsaasPaymentStatus(rawStatus: string): string {
  const status = String(rawStatus || '').trim().toUpperCase();
  switch (status) {
    case 'RECEIVED':
      return 'received';
    case 'CONFIRMED':
      return 'confirmed';
    case 'PENDING':
      return 'pending';
    case 'OVERDUE':
      return 'overdue';
    case 'REFUNDED':
      return 'refunded';
    case 'RECEIVED_IN_CASH':
      return 'received';
    case 'CANCELED':
    case 'CANCELLED':
    case 'DELETED':
      return 'canceled';
    default:
      return String(rawStatus || '').toLowerCase();
  }
}

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // console.log(`[admin-financial-dashboard] Request received: ${req.method} ${req.url}`);

    // 1. Authenticate & Authorize
    const { user, supabase: supabaseUser } = await requireAuth(req);
    
    // 2. Check Role (Admin Only)
    await requireRole(supabaseUser, user.id, ['ADMIN']);

    // console.log(`[admin-financial-dashboard] User authenticated & authorized: ${user.id}`);

    // Parse URL params
    const url = new URL(req.url)
    const type = url.searchParams.get('type') // 'overview' | 'payments' | 'reconcile' | 'reconcile-all'

    let result;

    if (type === 'overview') {
      const dateStartParam = url.searchParams.get('dateStart')
      const dateEndParam = url.searchParams.get('dateEnd')
      
      // Ensure ISO string format for TIMESTAMPTZ
      const dateStart = dateStartParam ? new Date(dateStartParam).toISOString() : null
      const dateEnd = dateEndParam ? new Date(dateEndParam).toISOString() : null
      
      // console.log(`[admin-financial-dashboard] Fetching overview. dateStart=${dateStart}, dateEnd=${dateEnd}`);

      let overviewData: any = null;
      let overviewError: any = null;

      const overviewV2 = await supabaseUser.rpc('get_admin_financial_overview', {
        date_start: dateStart,
        date_end: dateEnd,
      });

      if (!overviewV2.error) {
        overviewData = overviewV2.data;
      } else {
        // Backward compatibility with older RPC name.
        const legacyOverview = await supabaseUser.rpc('get_financial_overview', {
          date_start: dateStart,
          date_end: dateEnd,
        });
        overviewData = legacyOverview.data;
        overviewError = legacyOverview.error;
      }

      if (overviewError) throw overviewError;
      result = overviewData;
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

        // 1. Get Payment from DB (accept internal ID or external Asaas ID)
        let payment: any = null;
        let fetchError: any = null;

        const byInternal = await serviceClient
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .maybeSingle();

        payment = byInternal.data;
        fetchError = byInternal.error;

        if (!payment && !fetchError) {
          const byExternal = await serviceClient
              .from('payments')
              .select('*')
              .eq('external_payment_id', paymentId)
              .maybeSingle();
          payment = byExternal.data;
          fetchError = byExternal.error;
        }

        if (fetchError || !payment) throw new Error('Payment not found');
        if (!payment.external_payment_id) throw new Error('Payment has no external ID');

        // 2. Get Asaas Config
        const { data: config, error: configError } = await serviceClient.rpc('get_decrypted_asaas_config').single();
        if (configError || !config) throw new Error('Failed to load Asaas config');

        const apiKey = String(config.api_key || config.secret_key || '').trim();
        const runtimeEnv = String(config.env || config.environment || 'sandbox').toLowerCase();
        if (!apiKey) {
          throw new Error('Missing Asaas API key in configuration');
        }
        const baseUrl = runtimeEnv === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';

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
        const normalizedStatus = normalizeAsaasPaymentStatus(asaasData.status);
        if (normalizedStatus && normalizedStatus !== payment.status) {
            const { error: updateError } = await serviceClient
                .from('payments')
                .update({ 
                    status: normalizedStatus,
                    asaas_net_value: (asaasData?.netValue ?? asaasData?.net_value ?? null),
                    updated_at: new Date().toISOString()
                })
                .eq('id', paymentId);
            
            if (updateError) throw updateError;
            result = { reconciled: true, oldStatus: payment.status, newStatus: normalizedStatus, asaasStatus: asaasData.status };
        } else {
            await serviceClient
                .from('payments')
                .update({
                    asaas_net_value: (asaasData?.netValue ?? asaasData?.net_value ?? null),
                    updated_at: new Date().toISOString()
                })
                .eq('id', payment.id);
            result = { reconciled: true, status: payment.status, asaasStatus: asaasData.status, message: 'Status already up to date' };
        }
    } else if (type === 'reconcile-all') {
        const limit = Math.min(Number(url.searchParams.get('limit') || 200), 1000);

        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: config, error: configError } = await serviceClient.rpc('get_decrypted_asaas_config').single();
        if (configError || !config) throw new Error('Failed to load Asaas config');

        const apiKey = String(config.api_key || config.secret_key || '').trim();
        const runtimeEnv = String(config.env || config.environment || 'sandbox').toLowerCase();
        if (!apiKey) throw new Error('Missing Asaas API key in configuration');

        const baseUrl = runtimeEnv === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';

        const { data: dbPayments, error: dbPaymentsError } = await serviceClient
          .from('payments')
          .select('id, external_payment_id, status')
          .eq('provider', 'asaas')
          .not('external_payment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (dbPaymentsError) throw dbPaymentsError;

        let scanned = 0;
        let updated = 0;
        let failed = 0;
        const errors: Array<{ payment_id: string; external_payment_id: string | null; error: string }> = [];

        for (const payment of dbPayments || []) {
          scanned += 1;
          try {
            const asaasRes = await fetch(`${baseUrl}/payments/${payment.external_payment_id}`, {
              headers: { access_token: apiKey }
            });

            if (!asaasRes.ok) {
              const errText = await asaasRes.text();
              throw new Error(`Asaas API Error: ${errText}`);
            }

            const asaasData = await asaasRes.json();
            const normalizedStatus = normalizeAsaasPaymentStatus(asaasData.status);

            const updatePayload: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
              asaas_net_value: (asaasData?.netValue ?? asaasData?.net_value ?? null),
            };
            if (normalizedStatus) {
              updatePayload.status = normalizedStatus;
            }

            const { error: updErr } = await serviceClient
              .from('payments')
              .update(updatePayload)
              .eq('id', payment.id);

            if (updErr) throw updErr;
            updated += 1;
          } catch (e: any) {
            failed += 1;
            errors.push({
              payment_id: payment.id,
              external_payment_id: payment.external_payment_id ?? null,
              error: e?.message || 'unknown error',
            });
          }
        }

        result = {
          success: true,
          scanned,
          updated,
          failed,
          errors: errors.slice(0, 20),
          message: 'Batch reconciliation finished',
        };
    } else {
      throw new Error('Invalid type parameter')
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 200 
      }
    )

  } catch (error: any) {
    // console.error(`[admin-financial-dashboard] Error:`, error);

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: status
      }
    )
  }
})

