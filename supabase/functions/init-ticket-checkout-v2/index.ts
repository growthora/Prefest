
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

    // Create a client with the user's token to get their ID
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

    // Use admin client for data access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Event and Ticket Type
    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) throw new Error('Event not found');

    const { data: ticketType, error: ticketError } = await adminClient
      .from('ticket_types')
      .select('*')
      .eq('id', ticket_type_id)
      .single();

    if (ticketError || !ticketType) throw new Error('Ticket type not found');

    // 2. Validate Quantity
    if (ticketType.quantity_available - ticketType.quantity_sold < quantity) {
      throw new Error('Ingressos esgotados para este tipo');
    }

    // 3. Calculate Price
    const unitPrice = Number(ticketType.price);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const isFree = totalPrice === 0;

    if (!isFree) {
      // PAID FLOW: Create reserved ticket
      const { data: ticket, error: createError } = await adminClient
        .from('tickets')
        .insert({
          event_id,
          buyer_user_id: user.id,
          ticket_type_id,
          quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          status: 'reserved', // New status for unpaid but selected tickets
          is_free: false
        })
        .select()
        .single();

      if (createError) {
        console.error('Ticket creation error:', createError);
        throw new Error('Failed to reserve ticket');
      }

      return new Response(JSON.stringify({ 
        type: "paid", 
        nextStep: "payment", 
        ticket_id: ticket.id,
        amount: totalPrice
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // FREE FLOW: Check profile existence
      const { data: profile } = await adminClient
        .from('buyer_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      const hasProfile = !!profile;

      return new Response(JSON.stringify({ 
        type: "free", 
        nextStep: hasProfile ? "confirm" : "collect_personal_data",
        amount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
