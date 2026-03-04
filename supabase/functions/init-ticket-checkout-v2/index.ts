
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from "../_shared/requireAuth.ts";

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÃ“STICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

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
      // Instead of failing, we can return a specific code to frontend to prompt profile creation
      // Or just proceed if we are in free flow (but we need profile for ticket)
      // Let's return a specific error that frontend can handle
      console.warn("Profile not found for user:", user.id);
      throw new Error('Profile incomplete: Please complete your profile data');
    }

    // Removed strict profile validation to allow data collection in next step
    // if (!profile.cpf || !profile.phone || !profile.birth_date) { ... }

    // 2. Fetch Event and Ticket Type
    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) throw new Error('Event not found');

    if (event.sales_enabled === false) {
      return new Response(
        JSON.stringify({
          error: 'SALES_DISABLED',
          message: 'As vendas para este evento ainda nÃ£o foram abertas.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

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
        // console.error('Ticket creation error:', createError);
        throw new Error('Failed to reserve ticket');
      }

      return new Response(JSON.stringify({ 
        type: "paid", 
        nextStep: "payment", 
        ticket_id: ticket.id,
        amount: totalPrice
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });

    } else {
      // FREE FLOW: Profile validation deferred to frontend step 2
      return new Response(JSON.stringify({ 
        type: "free", 
        nextStep: "personal_data", // Force data verification step
        amount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
