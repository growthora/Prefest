import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/requireAuth.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    const { user } = await requireAuth(req)

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: accountData, error: accountError } = await adminClient
      .from('organizer_asaas_accounts')
      .select('id, asaas_account_id, kyc_status, is_active')
      .eq('organizer_user_id', user.id)
      .single()

    if (accountError || !accountData) {
      return new Response(
        JSON.stringify({ error: 'Asaas account not found for this organizer' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single()

    if (configError || !config) {
      return new Response(
        JSON.stringify({
          error: 'Asaas configuration error',
          details: configError?.message || 'Asaas integration not configured',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = config.api_key || config.secret_key
    const env = config.environment || config.env || 'sandbox'

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Asaas configuration error',
          details: 'Missing Asaas API key (secret_key_encrypted is empty or invalid)',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3'

    const balanceRes = await fetch(`${apiUrl}/finance/balance`, {
      method: 'GET',
      headers: {
        access_token: apiKey,
        walletId: accountData.asaas_account_id,
      },
    })

    const balanceData = await balanceRes.json()
    if (!balanceRes.ok) {
      return new Response(
        JSON.stringify({
          error: 'Error fetching balance from Asaas',
          details: balanceData,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: 'asaas',
        balance: Number(balanceData.balance || 0),
        account: accountData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

