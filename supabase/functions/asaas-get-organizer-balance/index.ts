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
      .select('id, asaas_account_id, asaas_wallet_id, kyc_status, is_active, payment_method_type, external_wallet_id, external_wallet_email')
      .eq('organizer_user_id', user.id)
      .single()

    if (accountError || !accountData) {
      return new Response(
        JSON.stringify({ error: 'Asaas account not found for this organizer' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    const apiKey = config.api_key || config.secret_key
    const platformWalletId = config.wallet_id || null
    const env = config.environment || config.env || 'sandbox'

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Asaas configuration error',
          details: 'Missing Asaas API key (secret_key_encrypted is empty or invalid)',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    let destinationWalletId: string | null =
      accountData.payment_method_type === 'EXTERNAL_WALLET'
        ? (accountData.external_wallet_id || null)
        : (accountData.asaas_wallet_id || null)

    // For SUBACCOUNT mode, balance must use real wallet id, never account id.
    if (accountData.payment_method_type !== 'EXTERNAL_WALLET' && !destinationWalletId && accountData.asaas_account_id) {
      const accountRes = await fetch(
        `${env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3'}/accounts/${accountData.asaas_account_id}`,
        {
          method: 'GET',
          headers: {
            access_token: apiKey,
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      )

      const rawAccountBody = await accountRes.text()
      let asaasAccountPayload: any = {}
      if (rawAccountBody) {
        try {
          asaasAccountPayload = JSON.parse(rawAccountBody)
        } catch (_parseErr) {
          asaasAccountPayload = { raw: rawAccountBody }
        }
      }

      if (accountRes.ok && asaasAccountPayload?.walletId) {
        destinationWalletId = String(asaasAccountPayload.walletId)
        await adminClient
          .from('organizer_asaas_accounts')
          .update({ asaas_wallet_id: destinationWalletId, updated_at: new Date().toISOString() })
          .eq('id', accountData.id)
      }
    }

    if (!destinationWalletId) {
      return new Response(
        JSON.stringify({
          error: 'ORGANIZER_MISSING_DESTINATION_WALLET',
          message: 'Configure primeiro seu método de recebimento Asaas.',
          account: accountData,
          debug: {
            payment_method_type: accountData.payment_method_type,
            asaas_account_id: accountData.asaas_account_id,
            asaas_wallet_id: accountData.asaas_wallet_id,
            external_wallet_id: accountData.external_wallet_id,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    if (platformWalletId && destinationWalletId === platformWalletId) {
      return new Response(
        JSON.stringify({
          error: 'ORGANIZER_WALLET_CONFLICT',
          message: 'Conta Asaas inválida: wallet do organizador está igual ao wallet da plataforma.',
          account: accountData,
          debug: {
            destination_wallet_id: destinationWalletId,
            platform_wallet_id: platformWalletId,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    const apiUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3'

    const balanceUrl = `${apiUrl}/finance/balance?walletId=${encodeURIComponent(destinationWalletId)}`
    const balanceRes = await fetch(balanceUrl, {
      method: 'GET',
      headers: {
        access_token: apiKey,
        walletId: destinationWalletId,
      },
    })

    const balanceData = await balanceRes.json()
    if (!balanceRes.ok) {
      return new Response(
        JSON.stringify({
          error: 'Error fetching balance from Asaas',
          details: balanceData,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    // Diagnostic: compare with master balance to detect ignored wallet filter.
    const masterBalanceRes = await fetch(`${apiUrl}/finance/balance`, {
      method: 'GET',
      headers: {
        access_token: apiKey,
      },
    })
    let masterBalance = null
    if (masterBalanceRes.ok) {
      const masterBalanceData = await masterBalanceRes.json().catch(() => ({}))
      masterBalance = Number(masterBalanceData?.balance ?? 0)
    }

    const walletBalance = Number(balanceData.balance || 0)
    const walletFilterPossiblyIgnored =
      masterBalance !== null &&
      Number.isFinite(masterBalance) &&
      Math.abs(walletBalance - masterBalance) < 0.000001

    if (accountData.payment_method_type === 'EXTERNAL_WALLET' && walletFilterPossiblyIgnored) {
      return new Response(
        JSON.stringify({
          error: 'EXTERNAL_WALLET_BALANCE_UNAVAILABLE',
          message:
            'Nao foi possivel consultar o saldo real da wallet externa usando a chave da plataforma.',
          destination_wallet_id: destinationWalletId,
          diagnostics: {
            wallet_balance: walletBalance,
            master_balance: masterBalance,
            wallet_filter_possibly_ignored: walletFilterPossiblyIgnored,
            platform_wallet_id: platformWalletId,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        source: 'asaas',
        balance: walletBalance,
        destination_wallet_id: destinationWalletId,
        balance_url: balanceUrl,
        payment_method_type: accountData.payment_method_type,
        diagnostics: {
          wallet_balance: walletBalance,
          master_balance: masterBalance,
          wallet_filter_possibly_ignored: walletFilterPossiblyIgnored,
          platform_wallet_id: platformWalletId,
        },
        account: accountData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
})
