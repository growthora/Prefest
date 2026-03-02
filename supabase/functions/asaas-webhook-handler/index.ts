import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req) => {
  // Webhooks do not require CORS headers as they are server-to-server calls.
  // We validate only via the token in the header.

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const asaasToken = req.headers.get('asaas-access-token');
    if (!asaasToken) {
        throw new Error('Missing webhook token');
    }

    // 1. Validate Token
    const { data: config, error: configError } = await supabaseClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config) {
         throw new Error('Configuration error');
    }
    
    if (config.webhook_token !== asaasToken) {
        throw new Error('Invalid webhook token');
    }

    const eventData = await req.json();
    const { event, payment, id: eventId } = eventData;
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

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

    // 1.5 Log Integration Event (Idempotency Check)
    // Try to insert event. If it exists (unique constraint on provider + external_event_id + event_type), skip.
    // STATUS: 'processing' initially
    const { error: insertError } = await supabaseClient
        .from('integration_events')
        .insert({
            provider: 'asaas',
            external_event_id: eventId || `evt_${Date.now()}`, // Fallback if ID missing
            event_type: event,
            payload: cleanPayload, // Using correct column name
            status: 'processing',
            request_id: requestId,
            correlation_id: payment?.id || null,
            processed_at: null // Will be updated on completion
        });

    if (insertError) {
        if (insertError.code === '23505') { // Unique violation
            console.log(`Webhook Event ${eventId} already received/processed. Skipping.`);
            return new Response(JSON.stringify({ received: true, skipped: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        console.error('Failed to log integration event:', insertError);
    }

    console.log(`Received event: ${event} for payment ${payment.id}`);
    
    // Default result status
    let processResultStatus = 'processed';
    let processErrorMessage = null;

    try {
        // 2. Map Asaas Status to Our Status
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
                newStatus = 'canceled';
                break;
            case 'PAYMENT_CANCELED':
                 newStatus = 'canceled';
                 break;
        }

        if (newStatus) {
            // Find internal payment ID
            const { data: paymentRecord, error: paymentError } = await supabaseClient
                .from('payments')
                .select('id')
                .eq('external_payment_id', payment.id)
                .single();

            if (paymentError || !paymentRecord) {
                console.error('Payment not found for external ID:', payment.id);
                processResultStatus = 'failed';
                processErrorMessage = `Payment not found: ${payment.id}`;
            } else {
                const { error: updateError } = await supabaseClient
                    .from('payments')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', paymentRecord.id);

                if (updateError) {
                     console.error('Error updating payment:', updateError);
                     processResultStatus = 'failed';
                     processErrorMessage = `Error updating payment: ${updateError.message}`;
                } else {
                     // Update payment_splits
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
        }
    } catch (processError: any) {
        processResultStatus = 'failed';
        processErrorMessage = processError.message;
        console.error('Processing Logic Error:', processError);
    }

    // 3. Mark Event as Processed (or Failed)
    if (!insertError) {
        await supabaseClient
            .from('integration_events')
            .update({ 
                status: processResultStatus, 
                processed_at: new Date().toISOString(),
                error_message: processErrorMessage
            })
            .eq('provider', 'asaas')
            .eq('external_event_id', eventId);
    }

    if (processResultStatus === 'failed') {
         // Return 200 to Asaas to stop retries if it's a logic error we can't fix by retrying?
         // Or 500 to force retry?
         // If payment not found, maybe retry won't help. 
         // But user asked for alerts on failed webhooks.
         // Let's return 200 but log error. Asaas retries can be aggressive.
         console.error(`Webhook failed processing: ${processErrorMessage}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
