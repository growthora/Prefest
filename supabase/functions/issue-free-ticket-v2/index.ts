
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from "../_shared/requireAuth.ts";

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
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

    const { event_id, ticket_type_id, quantity, coupon_code } = await req.json();

    if (!event_id || !ticket_type_id || !quantity) {
      throw new Error('Missing required fields');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // NEW: Check Event Purchase Availability (Global Blockade)
    const { data: isAvailable, error: validationError } = await adminClient
      .rpc('check_event_purchase_availability', { p_event_id: event_id });

    if (validationError || !isAvailable) {
      throw new Error(validationError?.message || 'Este evento já foi realizado ou as vendas estão encerradas.');
    }

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, sales_enabled')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    if (event.sales_enabled === false) {
      return new Response(
        JSON.stringify({
          error: 'SALES_DISABLED',
          message: 'As vendas para este evento ainda não foram abertas.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

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

    // 3. Verify Price (Must be 0 OR discounted to 0)
    const finalPrice = Number(ticketType.price);
    let appliedCouponId = null;
    let discountAmount = 0;

    if (finalPrice > 0) {
        // If price is > 0, we MUST have a coupon that reduces it to 0
        if (!coupon_code) {
             throw new Error('This endpoint is for free tickets only');
        }

        // Validate Coupon
        const now = new Date().toISOString();
        const { data: coupon, error: couponFindError } = await adminClient
            .from('coupons')
            .select('*')
            .eq('code', coupon_code.toUpperCase())
            .eq('active', true)
            .lte('valid_from', now)
            .or(`valid_until.is.null,valid_until.gte.${now}`)
            .single();

        if (couponFindError || !coupon) {
            throw new Error('Cupom inválido ou expirado');
        }

        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
             throw new Error('Cupom esgotado');
        }

        // Calculate discount
        let calculatedDiscount = 0;
        if (coupon.discount_type === 'percentage') {
            calculatedDiscount = (finalPrice * coupon.discount_value) / 100;
        } else {
            calculatedDiscount = coupon.discount_value;
        }
        
        // Check if it covers the full price
        // We accept if final price is 0 or less
        if (finalPrice - calculatedDiscount > 0) {
             throw new Error('Cupom não cobre o valor total do ingresso. Use o fluxo de pagamento.');
        }

        discountAmount = calculatedDiscount;
        appliedCouponId = coupon.id;

        // Record Usage
         const { error: usageError } = await adminClient
            .from('coupon_usage')
            .insert({
                coupon_id: coupon.id,
                user_id: user.id,
                event_id: event_id,
                discount_applied: discountAmount,
            });
            
        if (usageError) throw new Error('Erro ao registrar uso do cupom');

        // Update usage count
        await adminClient
            .from('coupons')
            .update({ current_uses: coupon.current_uses + 1 })
            .eq('id', coupon.id);
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
        unit_price: ticketType.price, // Original price
        total_price: 0, // Paid price
        discount_amount: discountAmount,
        coupon_id: appliedCouponId,
        status: 'issued', // Immediately valid
        is_free: true
      })
      .select()
      .single();

    if (createError) {
      // console.error('Ticket creation error:', createError);
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
       // console.error('Participant creation error:', participantError);
       // Rollback ticket creation
       await adminClient.from('tickets').delete().eq('id', ticket.id);
       // Decrement ticket sold count (rollback)
       await adminClient.rpc('increment_ticket_sold', { 
           p_ticket_type_id: ticket_type_id, 
           p_quantity: -quantity 
       });
       throw new Error('Failed to create participant record. Please try again.');
    }

    return new Response(JSON.stringify({ 
      success: true,
      ticket_id: ticket.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });

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


