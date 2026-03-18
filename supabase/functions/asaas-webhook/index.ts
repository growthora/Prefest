
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  let adminClient;
  let eventLogId = null;

  try {
    // Initialize Admin Client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables')
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Validate Webhook Token
    const incomingToken = req.headers.get('asaas-access-token')
    
    // Fetch stored token securely
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError) {
        // console.error('Config Error:', configError)
        return new Response(JSON.stringify({ error: 'Config error' }), { status: 500, headers: corsHeaders })
    }

    // If webhook token is configured, validate it
    if (config && config.webhook_token) {
        if (incomingToken !== config.webhook_token) {
            // console.error('Invalid Webhook Token')
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
             // console.error('Webhook token not configured in production')
             return new Response(JSON.stringify({ error: 'Webhook configuration missing' }), { status: 500, headers: corsHeaders })
        }
    }

    // 2. Parse Payload
    const body = await req.json()
    const { event, payment } = body

    if (!event || !payment || !payment.id) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: corsHeaders })
    }

    // Helper: Redact Sensitive Data
    const redactPayload = (payload: any): any => {
        if (!payload) return payload;
        const sensitiveKeys = ['cpf', 'cpfCnpj', 'email', 'mobilePhone', 'phone', 'creditCard'];
        const redacted = { ...payload };

        for (const key in redacted) {
            if (sensitiveKeys.includes(key)) {
                redacted[key] = '***REDACTED***';
            } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                redacted[key] = redactPayload(redacted[key]);
            }
        }
        return redacted;
    };

    const cleanPayload = redactPayload(body);

    // 2.1 Log Integration Event (MANDATORY)
    try {
        const { data: eventLog, error: eventLogError } = await adminClient
            .from('integration_events')
            .insert({
                provider: 'asaas',
                external_event_id: body.id || `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                event_type: event,
                payload: cleanPayload,
                received_at: new Date().toISOString(),
                status: 'processing'
            })

            .select('id')
            .single();
            
        if (eventLogError) {
            // console.error('CRITICAL: Failed to log integration event', eventLogError);
        } else {
            eventLogId = eventLog.id;
        }
    } catch (e) {
        // console.error('Error logging integration event:', e);
    }

    // console.log(`Received event: ${event} for payment ${payment.id}`)

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
                asaas_net_value: (payment?.netValue ?? payment?.net_value ?? null),
                updated_at: new Date().toISOString() 
            })
            .eq('external_payment_id', payment.id)
            .select()
            .single()

        if (paymentUpdateError) {
            // console.error('Error updating payment:', paymentUpdateError)
            // If payment doesn't exist, we might want to log it.
        } else if (updatedPayment) {
            // console.log(`Payment ${updatedPayment.id} updated to ${newStatus}`)
            
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
                    // console.error('Error updating ticket:', ticketError)
                } else {
                    // console.log(`Ticket ${updatedPayment.ticket_id} updated to ${ticketStatus}`)

                    if (ticketStatus === 'refunded') {
                        await adminClient
                            .from('event_participants')
                            .update({
                                status: 'cancelled',
                                total_paid: 0,
                            })
                            .eq('ticket_id', updatedPayment.ticket_id)

                        await adminClient
                            .from('refund_requests')
                            .update({
                                status: 'refunded',
                                provider_refund_id: payment.id,
                                reviewed_at: new Date().toISOString(),
                            })
                            .eq('payment_id', updatedPayment.id)
                    }

                    // 5.1 Create Event Participant (for attendance) if PAID
                    if (ticketStatus === 'paid') {
                        const { data: existingParticipant } = await adminClient
                            .from('event_participants')
                            .select('id')
                            .eq('ticket_id', updatedPayment.ticket_id)
                            .single();

                        if (!existingParticipant) {
                            // Fetch ticket details
                            const { data: ticketData } = await adminClient
                                .from('tickets')
                                .select('*')
                                .eq('id', updatedPayment.ticket_id)
                                .single();

                            if (ticketData) {
                                const { error: participantError } = await adminClient
                                    .from('event_participants')
                                    .insert({
                                        event_id: ticketData.event_id,
                                        user_id: ticketData.buyer_user_id,
                                        ticket_type_id: ticketData.ticket_type_id,
                                        ticket_quantity: ticketData.quantity,
                                        total_paid: ticketData.total_price,
                                        status: 'valid',
                                        ticket_id: ticketData.id
                                    });
                                
                                if (participantError) {
                                    // console.error('Error creating participant:', participantError);
                                } else {
                                    // console.log(`Participant created for ticket ${ticketData.id}`);
                                }
                            }
                        }
                    }
                }
            }

            // 6. Update Payment Splits Status
            // Logic: PAYMENT_CONFIRMED/RECEIVED -> 'received'
            //        PAYMENT_REFUNDED -> 'refunded'
            let splitStatus = newStatus;
            if (newStatus === 'paid') splitStatus = 'received';
            
            const { error: splitError, count: splitCount } = await adminClient
                .from('payment_splits')
                .update({ 
                    status: splitStatus, 
                    updated_at: new Date().toISOString() 
                })
                .eq('payment_id', updatedPayment.id)
                .select('id', { count: 'exact' });
            
            if (splitError) {
                 // console.error('Error updating splits:', splitError);
                 if (eventLogId) {
                     await adminClient.from('integration_events').update({ 
                         error_message: `Split update error: ${splitError.message}` 
                     }).eq('id', eventLogId);
                 }
            } else if (splitCount === 0) {
                 // console.warn(`CRITICAL WARNING: No payment_splits found for payment ${updatedPayment.id}. This means split was not recorded during checkout.`);
                 if (eventLogId) {
                     await adminClient.from('integration_events').update({ 
                         error_message: `CRITICAL: No payment_splits found for payment ${updatedPayment.id}` 
                     }).eq('id', eventLogId);
                 }
            } else {
                 // console.log(`Splits for payment ${updatedPayment.id} updated to ${splitStatus}`);
            }

            // 7. Update Integration Event Status (Success)
            if (eventLogId) {
                await adminClient
                    .from('integration_events')
                    .update({ 
                        status: 'processed', 
                        processed_at: new Date().toISOString() 
                    })
                    .eq('id', eventLogId);
            }
        } else {
             // console.warn('Payment not found for external ID:', payment.id)
        }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    // console.error('Webhook Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
})

