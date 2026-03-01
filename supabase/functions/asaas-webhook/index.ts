
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
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

    // 1. Validate Webhook Token
    const incomingToken = req.headers.get('asaas-access-token')
    
    // Fetch stored token securely
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError || !config) {
        return new Response(JSON.stringify({ error: 'Config error' }), { status: 500, headers: corsHeaders })
    }

    if (config.webhook_token && incomingToken !== config.webhook_token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // 2. Parse Payload
    const body = await req.json()
    const { event, payment } = body

    if (!event || !payment || !payment.id) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    // 3. Check Idempotency
    const { data: isNew, error: eventError } = await adminClient.rpc('register_integration_event', {
      p_provider: 'asaas',
      p_external_event_id: body.id, // Event ID from Asaas payload
      p_event_type: event,
      p_payload: body
    })

    if (eventError) {
        console.error('Event registration error:', eventError)
        return new Response(JSON.stringify({ error: 'Event registration failed' }), { status: 500, headers: corsHeaders })
    }

    if (!isNew) {
      return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), { status: 200, headers: corsHeaders })
    }

    // 4. Map Status
    let newStatus = ''
    switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
            newStatus = 'PAID'
            break
        case 'PAYMENT_OVERDUE':
            newStatus = 'OVERDUE'
            break
        case 'PAYMENT_REFUNDED':
            newStatus = 'REFUNDED'
            break
        case 'PAYMENT_DELETED':
            newStatus = 'CANCELLED'
            break
        case 'PAYMENT_RESTORED':
            newStatus = 'PENDING'
            break
        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE':
            newStatus = 'CHARGEBACK'
            break
        case 'PAYMENT_AWAITING_RISK_ANALYSIS':
            newStatus = 'AWAITING_RISK_ANALYSIS'
            break
        case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
            newStatus = 'APPROVED_BY_RISK_ANALYSIS'
            break
        case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
            newStatus = 'REPROVED_BY_RISK_ANALYSIS'
            break
        default:
            // Other events (e.g. PAYMENT_UPDATED) might not change status
            break
    }

    if (newStatus) {
        // 5. Update Payments Table
        const { data: updatedPayment, error: paymentUpdateError } = await adminClient
            .from('payments')
            .update({ status: newStatus, updated_at: new Date() })
            .eq('external_payment_id', payment.id)
            .select()

        if (paymentUpdateError) {
            console.error('Error updating payment:', paymentUpdateError)
        } else if (updatedPayment && updatedPayment.length > 0) {
            // 6. Update Payment Splits Table
            // Find splits linked to this payment
            // Note: payment_id in payment_splits is the local UUID of the payment
            const paymentId = updatedPayment[0].id
            
            const { error: splitUpdateError } = await adminClient
                .from('payment_splits')
                .update({ status: newStatus, updated_at: new Date() })
                .eq('payment_id', paymentId)
            
            if (splitUpdateError) {
                console.error('Error updating split:', splitUpdateError)
            }
        } else {
             console.warn('Payment not found for external ID:', payment.id)
        }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Always return 200 to avoid webhook retries on logic errors, unless transient
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
