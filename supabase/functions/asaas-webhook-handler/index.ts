import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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
    const { event, payment } = eventData;

    console.log(`Received event: ${event} for payment ${payment.id}`);

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
        const { error: updateError } = await supabaseClient
            .from('payments')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('external_payment_id', payment.id);

        if (updateError) console.error('Error updating payment:', updateError);
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
