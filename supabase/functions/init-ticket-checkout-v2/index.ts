
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from "../_shared/requireAuth.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Verify User Authentication
    const { user } = await requireAuth(req);

    const { event_id, ticket_type_id, quantity } = await req.json();

    if (!event_id || !ticket_type_id || !quantity) {
      throw new Error('Missing required fields');
    }

    // Use admin client for data access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch User Profile and Validate Data
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('cpf, phone, birth_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    if (!profile.cpf || !profile.phone || !profile.birth_date) {
      return new Response(JSON.stringify({ error: 'Dados incompletos. Por favor, complete seu cadastro.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch Event and Ticket Type
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

    // 3. Validate Quantity
    if (ticketType.quantity_available - ticketType.quantity_sold < quantity) {
      throw new Error('Ingressos esgotados para este tipo');
    }

    // 4. Calculate Price
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
      // FREE FLOW: Profile is already validated above
      return new Response(JSON.stringify({ 
        type: "free", 
        nextStep: "confirm",
        amount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
