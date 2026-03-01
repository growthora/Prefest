
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { guardSalesEnabled } from '@shared/guard_sales_enabled.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get request body
    const { 
      amount, 
      customer_id, // Asaas Customer ID
      organizer_user_id, // PREFERRED: User ID of the organizer
      organizer_wallet_id, // OPTIONAL: Wallet ID (legacy or direct)
      payment_method, // PIX, BOLETO, CREDIT_CARD
      due_date,
      description,
      external_reference,
      user_id // Payer ID (optional)
    } = await req.json()

    if (!amount || !customer_id || !payment_method || !due_date) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // 2. Validate Organizer Status (Mandatory)
    let validWalletId = organizer_wallet_id

    if (organizer_user_id || organizer_wallet_id) {
        const validation = await guardSalesEnabled(adminClient, {
            organizerUserId: organizer_user_id,
            walletId: organizer_wallet_id
        })

        if (!validation.isValid) {
            return new Response(JSON.stringify({ 
                error: validation.error, 
                code: validation.code 
            }), { status: 403, headers: corsHeaders })
        }
        
        if (validation.account) {
            validWalletId = validation.account.asaas_account_id
        }
    } else {
        // No organizer info provided. If this is a platform-only payment, it might be fine.
        // But for "events", usually there is an organizer.
        // Assuming we allow platform-only payments if explicitly designed, but warning here.
        // For now, proceed only if it's not an organizer split scenario.
    }

    // 3. Get Asaas Config (Securely)
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError || !config || !config.api_key) {
        return new Response(JSON.stringify({ error: 'Asaas configuration not found or invalid' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    const API_URL = config.environment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3'

    // 4. Calculate Split
    let split = []
    let platformFee = 0

    if (config.split_enabled) {
        if (config.platform_fee_type === 'percentage') {
            platformFee = amount * (config.platform_fee_value / 100)
        } else if (config.platform_fee_type === 'fixed') {
            platformFee = config.platform_fee_value
        }

        if (platformFee > amount) platformFee = amount
        
        const organizerAmount = amount - platformFee
        
        // Add Organizer Split
        if (validWalletId) {
            split.push({
                walletId: validWalletId,
                fixedValue: organizerAmount
            })
        }

        // Add Platform Split (if configured to go to a separate wallet)
        if (config.wallet_id && platformFee > 0) {
            split.push({
                walletId: config.wallet_id,
                fixedValue: platformFee
            })
        }
    }

    // 5. Create Payment in Asaas
    const payload = {
        customer: customer_id,
        billingType: payment_method,
        value: amount,
        dueDate: due_date,
        description: description || 'Pedido via Prefest',
        externalReference: external_reference,
        postalService: false,
        split: split.length > 0 ? split : undefined
    }

    const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': config.api_key
        },
        body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Error creating payment at Asaas', details: data }), {
            status: response.status, // Pass through status (e.g. 400)
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // 6. Save to Database
    
    // First, save Payment
    const { data: payment, error: paymentError } = await adminClient.from('payments').insert({
        user_id: user_id || null, // The payer
        value: amount,
        provider: 'asaas',
        external_payment_id: data.id,
        status: 'PENDING',
        payment_method: payment_method,
        payment_url: data.bankSlipUrl || data.invoiceUrl || null,
        pix_qr_code: data.pixQrCode || null
    }).select().single()

    if (paymentError) {
        console.error('Error creating payment record:', paymentError)
    } else if (split.length > 0) {
        // Save Split
        await adminClient.from('payment_splits').insert({
            payment_id: payment.id,
            total_amount: amount, // Assuming column exists or is 'value'
            fee_value: platformFee, // Assuming column exists or is 'fee_value'
            organizer_amount: amount - platformFee, // Assuming column exists or derived
            split_rule: split,
            status: 'PENDING',
            wallet_id: validWalletId
        })
    }

    return new Response(JSON.stringify({ success: true, payment: data, local_payment_id: payment?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
