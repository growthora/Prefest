import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "npm:qrcode";

Deno.serve(async (req) => {
  // Webhooks do not require CORS headers as they are server-to-server calls.
  // We validate only via the token in the header.

  // [SECURITY] Helper to handle unauthorized responses
  const unauthorized = () => new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401, 
    headers: { 'Content-Type': 'application/json; charset=utf-8' } 
  });

  // [SUCCESS] Helper to handle success/ignored responses (ALWAYS 200 to avoid penalties)
  const ok = (msg = 'received') => new Response(JSON.stringify({ [msg]: true }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json; charset=utf-8' } 
  });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Security & Auth Check
    const asaasToken = req.headers.get('asaas-access-token');
    if (!asaasToken) {
        console.warn('Missing asaas-access-token header');
        return unauthorized();
    }

    // Validate Token against DB
    const { data: config, error: configError } = await supabaseClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config) {
         console.error('Configuration error or missing:', configError);
         return unauthorized();
    }
    
    if (config.webhook_token !== asaasToken) {
        console.warn('Invalid webhook token');
        return unauthorized();
    }

    // 2. Parse Body Defensively
    let eventData;
    try {
        eventData = await req.json();
    } catch (e) {
        console.error('Failed to parse JSON body', e);
        return ok('invalid_json_handled');
    }

    // 3. Extract & Validate Event
    const { event } = eventData;
    const payment = eventData.payment || null; // Safe access
    const eventId = eventData.id || `evt_${crypto.randomUUID()}`;
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

    // 4. Filter Ignored Events (Explicit Whitelist/Blacklist)
    const IGNORED_EVENTS = [
        'ACCESS_TOKEN_CREATED', 
        'API_KEY_CREATED', 
        'WEBHOOK_CREATED', 
        'WEBHOOK_UPDATED',
        'ACCOUNT_STATUS_CHANGED',
        'ACCOUNT_CREATED'
    ];

    if (!event || IGNORED_EVENTS.includes(event)) {
        console.log(`[INFO] Ignoring event: ${event}`);
        return ok('ignored');
    }

    // 5. Validate Payment Data for Payment Events
    if (event.startsWith('PAYMENT_') || event.startsWith('SUBSCRIPTION_')) {
        if (!payment || !payment.id) {
            console.error(`[WARN] Event ${event} received without payment data/id. Ignoring.`);
            return ok('missing_payment_data');
        }
    }

    console.log(`Processing event: ${event} | ID: ${eventId} | Payment: ${payment?.id || 'N/A'}`);

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

    const cleanPayload = redactPayload(eventData);

    // 6. Log Integration Event (Idempotency)
    const { error: insertError } = await supabaseClient
        .from('integration_events')
        .insert({
            provider: 'asaas',
            external_event_id: eventId,
            event_type: event,
            payload: cleanPayload,
            status: 'processing',
            request_id: requestId,
            correlation_id: payment?.id || null,
            processed_at: null,
            received_at: new Date().toISOString()
        });

    if (insertError) {
        if (insertError.code === '23505') { // Unique violation
            console.log(`[INFO] Event ${eventId} already processed. Skipping.`);
            return ok('already_processed');
        }
        console.error('Failed to log integration event:', insertError);
    }

    // 7. Process Business Logic
    let processResultStatus = 'processed';
    let processErrorMessage = null;

    try {
        let newStatus = null;
        switch (event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
                newStatus = 'paid';
                break;
            case 'PAYMENT_REFUNDED':
                newStatus = 'refunded';
                break;
            case 'PAYMENT_OVERDUE': 
            case 'PAYMENT_CANCELED':
            case 'PAYMENT_CANCELLED':
            case 'PAYMENT_DELETED':
                newStatus = 'cancelled'; // normalized to 'cancelled' (LL vs L)
                break;
            case 'PAYMENT_RESTORED':
                newStatus = 'pending';
                break;
        }

        if (newStatus && payment?.id) {
            // Find internal payment ID AND Ticket ID
            const { data: paymentRecord, error: paymentError } = await supabaseClient
                .from('payments')
                .select('id, ticket_id')
                .eq('external_payment_id', payment.id)
                .single();

            if (paymentError || !paymentRecord) {
                console.warn(`Payment not found for external ID: ${payment.id}`);
                processResultStatus = 'failed';
                processErrorMessage = `Payment not found: ${payment.id}`;
            } else {
                // Update Payment Status
                const { error: updateError } = await supabaseClient
                    .from('payments')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', paymentRecord.id);

                if (updateError) {
                     throw new Error(`Error updating payment: ${updateError.message}`);
                }
                
                console.log(`Payment ${paymentRecord.id} updated to ${newStatus}`);

                // Update Ticket Status
                if (paymentRecord.ticket_id) {
                    const { error: ticketError } = await supabaseClient
                        .from('tickets')
                        .update({ status: newStatus, updated_at: new Date().toISOString() })
                        .eq('id', paymentRecord.ticket_id);
                    
                    if (ticketError) {
                        console.error('Ticket update error:', ticketError);
                        // Don't throw, proceed to splits
                    } else {
                        console.log(`Ticket ${paymentRecord.ticket_id} updated to ${newStatus}`);
                        
                        // Create Participant if PAID
                        if (newStatus === 'paid') {
                             const { data: existingParticipant } = await supabaseClient
                                .from('event_participants')
                                .select('id')
                                .eq('ticket_id', paymentRecord.ticket_id)
                                .single();
                             
                             if (!existingParticipant) {
                                 // Fetch ticket details for participant creation
                                 const { data: ticketData } = await supabaseClient
                                    .from('tickets')
                                    .select('*')
                                    .eq('id', paymentRecord.ticket_id)
                                    .single();
                                 
                                 if (ticketData) {
                                     const { data: newParticipant, error: participantError } = await supabaseClient
                                        .from('event_participants')
                                        .insert({
                                            event_id: ticketData.event_id,
                                            user_id: ticketData.buyer_user_id,
                                            ticket_type_id: ticketData.ticket_type_id,
                                            ticket_quantity: ticketData.quantity,
                                            total_paid: ticketData.total_price,
                                            status: 'valid',
                                            ticket_id: ticketData.id,
                                            ticket_token: ticketData.id
                                        })
                                        .select('*')
                                        .single();
                                     
                                     if (participantError) {
                                         console.error('Error creating participant:', participantError);
                                     } else if (newParticipant) {
                                         console.log(`Participant created: ${newParticipant.id}`);

                                         // Generate and save QR Code
                                         try {
                                             let qrContent = '';
                                             if (newParticipant.ticket_code) {
                                                 qrContent = newParticipant.ticket_code;
                                             } else {
                                                 // Legacy fallback
                                                 qrContent = JSON.stringify({
                                                     t: newParticipant.id,
                                                     e: newParticipant.event_id,
                                                     k: newParticipant.ticket_token
                                                 });
                                             }

                                             const qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
                                                width: 300,
                                                margin: 2,
                                                color: {
                                                  dark: '#000000',
                                                  light: '#ffffff',
                                                },
                                                errorCorrectionLevel: 'M'
                                             });

                                             const { error: updateQrError } = await supabaseClient
                                                .from('event_participants')
                                                .update({ qr_code_data: qrCodeDataUrl })
                                                .eq('id', newParticipant.id);

                                             if (updateQrError) {
                                                 console.error('Error updating QR code:', updateQrError);
                                             } else {
                                                 console.log('QR Code generated and saved.');
                                             }
                                         } catch (qrError) {
                                             console.error('Error generating QR code:', qrError);
                                         }
                                     }
                                 }
                             }
                        }
                    }
                }

                // Update payment_splits if applicable
                if (newStatus === 'paid') {
                     await supabaseClient
                        .from('payment_splits')
                        .update({ status: 'received', updated_at: new Date().toISOString() })
                        .eq('payment_id', paymentRecord.id);
                } else if (newStatus === 'refunded') {
                     await supabaseClient
                        .from('payment_splits')
                        .update({ status: 'refunded', updated_at: new Date().toISOString() })
                        .eq('payment_id', paymentRecord.id);
                }
            }
        }
    } catch (processError: any) {
        processResultStatus = 'failed';
        processErrorMessage = processError.message;
        console.error('Processing Logic Error:', processError);
    }

    // 8. Update Event Log
    if (!insertError) {
        await supabaseClient
            .from('integration_events')
            .update({ 
                status: processResultStatus, 
                processed_at: new Date().toISOString(),
                error_message: processErrorMessage
            })
            .eq('external_event_id', eventId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    console.error('Webhook Global Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
});
