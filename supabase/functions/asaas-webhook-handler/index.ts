import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async (req) => {
  // Webhooks do not require CORS headers as they are server-to-server calls.
  // We validate only via the token in the header.

  // [SECURITY] Helper to handle unauthorized responses
  const unauthorized = () => new Response(JSON.stringify({ error: 'Unauthorized' }), { 
    status: 401, 
    headers: { 'Content-Type': 'application/json' } 
  });

  // [SUCCESS] Helper to handle success/ignored responses (ALWAYS 200 to avoid penalties)
  const ok = (msg = 'received') => new Response(JSON.stringify({ [msg]: true }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
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
         // If we can't load config, we can't validate token. 
         // Safest is to reject (401/500) or return 200 to stop retries if it's permanent?
         // Security wise: 500 or 401. But user wants NO penalties.
         // If it's a config error, Asaas retrying might be good if DB is temp down.
         // But if it's permanent, we get penalized.
         // Let's return 401 (Unauthorized) which implies "Fix your auth/config".
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
            processed_at: null
        });

    if (insertError) {
        if (insertError.code === '23505') { // Unique violation
            console.log(`[INFO] Event ${eventId} already processed. Skipping.`);
            return ok('already_processed');
        }
        console.error('Failed to log integration event:', insertError);
        // Continue processing even if log fails? 
        // Better to try processing, but log error.
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
            case 'PAYMENT_CANCELED': // Fixed typo from original code (check both spellings?)
            case 'PAYMENT_CANCELLED': // Asaas uses CANCELLED sometimes? Check docs. standard is usually double L in english but Asaas might vary.
                newStatus = 'canceled';
                break;
        }

        if (newStatus && payment?.id) {
            // Find internal payment ID
            const { data: paymentRecord, error: paymentError } = await supabaseClient
                .from('payments')
                .select('id')
                .eq('external_payment_id', payment.id)
                .single();

            if (paymentError || !paymentRecord) {
                console.warn(`Payment not found for external ID: ${payment.id}`);
                processResultStatus = 'failed';
                processErrorMessage = `Payment not found: ${payment.id}`;
            } else {
                const { error: updateError } = await supabaseClient
                    .from('payments')
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', paymentRecord.id);

                if (updateError) {
                     throw new Error(`Error updating payment: ${updateError.message}`);
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
            .eq('provider', 'asaas')
            .eq('external_event_id', eventId);
    }

    // 9. Final Response
    // Always return 200 OK to Asaas to confirm receipt
    return ok();

  } catch (error) {
    // [CRITICAL] Global Catch-All
    // Log the error but return 200 to Asaas to prevent penalties/retries for unrecoverable errors
    console.error('CRITICAL Webhook Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error (Handled)', details: error.message }), {
      status: 200, // Return 200 as requested by "Never crash/penalize" rule
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
