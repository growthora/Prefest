
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
    // Initialize Admin Client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables')
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Validate Webhook Token
    const incomingToken = req.headers.get('asaas-access-token')
    
    // Fetch stored token securely
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError) {
        console.error('Config Error:', configError)
        return new Response(JSON.stringify({ error: 'Config error' }), { status: 500, headers: corsHeaders })
    }

    // If webhook token is configured, validate it
    if (config && config.webhook_token) {
        if (incomingToken !== config.webhook_token) {
            console.error('Invalid Webhook Token')
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
        }
    } else {
        // If not configured, we might want to log a warning or block. 
        // For security, if it's production, we should block.
        // But for initial setup, maybe allow? No, strict is better.
        // Unless it's sandbox and user hasn't set it up yet.
        // Let's assume if it's missing in DB, we can't validate, so we proceed with caution or block.
        // Given "Webhook como fonte única de verdade", security is key.
        if (config?.env === 'production') {
             console.error('Webhook token not configured in production')
             return new Response(JSON.stringify({ error: 'Webhook configuration missing' }), { status: 500, headers: corsHeaders })
        }
    }

    // 2. Parse Payload
    const body = await req.json()
    const { event, payment } = body

    if (!event || !payment || !payment.id) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    console.log(`Received event: ${event} for payment ${payment.id}`)

    // 3. Map Status
    let newStatus = ''
    let ticketStatus = ''
    
    switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
            newStatus = 'paid'
            ticketStatus = 'paid'
            break
        case 'PAYMENT_OVERDUE':
            newStatus = 'overdue'
            ticketStatus = 'cancelled' // Or expired
            break
        case 'PAYMENT_REFUNDED':
            newStatus = 'refunded'
            ticketStatus = 'refunded'
            break
        case 'PAYMENT_DELETED':
        case 'PAYMENT_CANCELLED': // Asaas sends PAYMENT_DELETED usually for manual removal
            newStatus = 'cancelled'
            ticketStatus = 'cancelled'
            break
        case 'PAYMENT_RESTORED':
            newStatus = 'pending'
            ticketStatus = 'pending'
            break
        case 'PAYMENT_CHARGEBACK_REQUESTED':
        case 'PAYMENT_CHARGEBACK_DISPUTE':
            newStatus = 'chargeback'
            ticketStatus = 'disputed'
            break
        case 'PAYMENT_AWAITING_RISK_ANALYSIS':
            newStatus = 'awaiting_risk_analysis'
            break
        case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
            newStatus = 'approved_by_risk_analysis'
            break
        case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
            newStatus = 'reproved_by_risk_analysis'
            ticketStatus = 'cancelled'
            break
        default:
            // Other events (e.g. PAYMENT_UPDATED, PAYMENT_CREATED) might not change status
            break
    }

    if (newStatus) {
        // 4. Update Payments Table
        const { data: updatedPayment, error: paymentUpdateError } = await adminClient
            .from('payments')
            .update({ 
                status: newStatus, 
                updated_at: new Date().toISOString() 
            })
            .eq('external_payment_id', payment.id)
            .select()
            .single()

        if (paymentUpdateError) {
            console.error('Error updating payment:', paymentUpdateError)
            // If payment doesn't exist, we might want to log it.
        } else if (updatedPayment) {
            console.log(`Payment ${updatedPayment.id} updated to ${newStatus}`)
            
            // 5. Update Ticket Status
            if (ticketStatus) {
                const { error: ticketError } = await adminClient
                    .from('tickets')
                    .update({ 
                        status: ticketStatus, 
                        updated_at: new Date().toISOString() 
                    })
                    .eq('id', updatedPayment.ticket_id)

                if (ticketError) {
                    console.error('Error updating ticket:', ticketError)
                } else {
                    console.log(`Ticket ${updatedPayment.ticket_id} updated to ${ticketStatus}`)
                }
            }

            // 6. Update Payment Splits Status
            // Usually splits follow the payment status (paid/pending/cancelled)
            // If payment is paid, splits are 'paid' (or effectively waiting for transfer)
            // If payment is cancelled/refunded, splits are cancelled/refunded
            
            // Note: In our model, split status might be 'pending', 'paid', 'cancelled'
            const { error: splitError } = await adminClient
                .from('payment_splits')
                .update({ 
                    status: newStatus, 
                    updated_at: new Date().toISOString() 
                })
                .eq('payment_id', updatedPayment.id)
            
            if (splitError) {
                 console.error('Error updating splits:', splitError)
            } else {
                 console.log(`Splits for payment ${updatedPayment.id} updated to ${newStatus}`)
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
