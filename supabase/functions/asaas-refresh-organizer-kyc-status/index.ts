
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user } = await requireAuth(req);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Determine organizer ID.
    const organizerId = user.id
    
    // Retrieve Asaas Account ID
    const { data: accountData, error: accountError } = await adminClient
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', organizerId)
        .single()

    if (accountError || !accountData) {
        return new Response(JSON.stringify({ error: 'Asaas account not found for this organizer' }), { status: 404, headers: corsHeaders })
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
        { status: 500, headers: corsHeaders }
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
        { status: 500, headers: corsHeaders }
      )
    }

    const API_URL = env === 'production'
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3'

    const paymentMethodType = String(accountData.payment_method_type || 'SUBACCOUNT')

    let kycStatus = 'pending'
    let isActive = false

    if (paymentMethodType === 'EXTERNAL_WALLET') {
      const walletId = accountData.external_wallet_id || accountData.asaas_account_id

      if (!walletId) {
        return new Response(
          JSON.stringify({
            error: 'Missing external wallet id',
            details: { code: 'ORGANIZER_MISSING_DESTINATION_WALLET' },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        )
      }

      // For external wallets we validate existence/access by querying wallet balance.
      const balanceRes = await fetch(`${API_URL}/finance/balance?walletId=${encodeURIComponent(walletId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'access_token': apiKey,
          'walletId': walletId,
        }
      })

      const balanceRaw = await balanceRes.text()
      let balanceData: any = {}
      if (balanceRaw) {
        try {
          balanceData = JSON.parse(balanceRaw)
        } catch (_parseError) {
          balanceData = { raw: balanceRaw }
        }
      }

      if (!balanceRes.ok) {
        return new Response(
          JSON.stringify({
            error: 'Error fetching external wallet from Asaas',
            details: { status: balanceRes.status, body: balanceData },
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        )
      }

      // External wallet validated successfully.
      kycStatus = 'approved'
      isActive = true
    } else {
      // Fetch subaccount status from Asaas using account id.
      const response = await fetch(`${API_URL}/accounts/${accountData.asaas_account_id}`, {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'access_token': apiKey
          }
      })

      const rawBody = await response.text()
      let data: any = {}
      if (rawBody) {
        try {
          data = JSON.parse(rawBody)
        } catch (_parseError) {
          data = { raw: rawBody }
        }
      }
      
      if (!response.ok) {
          return new Response(JSON.stringify({ error: 'Error fetching account from Asaas', details: { status: response.status, body: data } }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
          })
      }

      if (data.status) {
          kycStatus = data.status.toLowerCase()
      }
      
      const allowedStatuses = ['pending', 'approved', 'rejected', 'awaiting_approval']
      if (!allowedStatuses.includes(kycStatus)) {
          if (kycStatus === 'denied') kycStatus = 'rejected'
          else if (kycStatus === 'awaiting_documents') kycStatus = 'awaiting_approval'
          else kycStatus = 'pending' 
      }

      isActive = kycStatus === 'approved'

      // Persist subaccount wallet id for balance/split requests.
      if (data.walletId && typeof data.walletId === 'string') {
        accountData.asaas_wallet_id = data.walletId
      }
    }

    // Update DB
    const { data: updatedAccount, error: updateError } = await adminClient
        .from('organizer_asaas_accounts')
        .update({
            kyc_status: kycStatus,
            is_active: isActive,
            asaas_wallet_id: accountData.asaas_wallet_id || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', accountData.id)
        .select()
        .single()

    if (updateError) {
        // console.error('DB Update Error:', updateError);
        return new Response(JSON.stringify({ error: 'Error updating account status in database', details: updateError }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        })
    }

    return new Response(JSON.stringify({
        success: true,
        payment_method_type: paymentMethodType,
        status: kycStatus,
        is_active: isActive,
        account: updatedAccount
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    })
  }
})
