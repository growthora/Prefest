
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    const { event_id, ticket_type_id, quantity } = await req.json();

    if (!event_id || !ticket_type_id || !quantity) {
      throw new Error('Missing required fields');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify Profile Exists
    const { data: profile } = await adminClient
      .from('buyer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      throw new Error('Buyer profile incomplete');
    }

    // 2. Fetch Ticket Type
    const { data: ticketType, error: ticketError } = await adminClient
      .from('ticket_types')
      .select('*')
      .eq('id', ticket_type_id)
      .single();

    if (ticketError || !ticketType) throw new Error('Ticket type not found');

    // 3. Verify Price (Must be 0)
    if (Number(ticketType.price) > 0) {
      throw new Error('This endpoint is for free tickets only');
    }

    // 4. Validate Quantity
    if (ticketType.quantity_available - ticketType.quantity_sold < quantity) {
      throw new Error('Ingressos esgotados');
    }

    // 5. Create Ticket
    const { data: ticket, error: createError } = await adminClient
      .from('tickets')
      .insert({
        event_id,
        buyer_user_id: user.id,
        buyer_profile_id: user.id,
        ticket_type_id,
        quantity,
        unit_price: 0,
        total_price: 0,
        status: 'issued', // Immediately valid
        is_free: true
      })
      .select()
      .single();

    if (createError) {
      console.error('Ticket creation error:', createError);
      throw new Error('Failed to issue ticket');
    }

    // 6. Update Quantity Sold
    await adminClient.rpc('increment_ticket_sold', { 
        p_ticket_type_id: ticket_type_id, 
        p_quantity: quantity 
    });

    // 7. Create Event Participant
    // This is needed for QR code and check-in
    const { error: participantError } = await adminClient
      .from('event_participants')
      .insert({
        event_id,
        user_id: user.id,
        ticket_type_id,
        ticket_quantity: quantity,
        total_paid: 0,
        status: 'valid',
        ticket_token: ticket.id // Using ticket ID as token link
      });
      
    if (participantError) {
       console.error('Participant creation error:', participantError);
       // Note: Should rollback ticket creation here ideally
    }

    return new Response(JSON.stringify({ 
      success: true,
      ticket_id: ticket.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
