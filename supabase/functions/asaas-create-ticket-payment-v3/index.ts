import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"

Deno.serve(async (req) => {
  // 1. Handle CORS (Strictly first)
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req)

  try {
    // 2. Validate Authorization Header & Verify User using requireAuth
    const { user } = await requireAuth(req);

    // 5. Initialize Admin Client for Privileged Operations (Service Role)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5.5 Check Rate Limit (10 requests per minute per user)
    const { data: isAllowed, error: rateLimitError } = await adminClient.rpc('check_rate_limit', {
        p_key: `payment_creation:${user.id}`,
        p_limit: 10,
        p_window_seconds: 60
    });

    if (rateLimitError) {
      console.error('Rate Limit Check Error:', rateLimitError);
      // Fail closed for security but allow if function missing (dev)
      if (rateLimitError.code !== 'PGRST202') { // Function not found
         throw new Error('System busy, please try again later.');
      }
    }

    if (isAllowed === false) {
        return new Response(
            JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 6. Parse Request Body
    const { ticket_id, billing_type, coupon_code } = await req.json()

    if (!ticket_id || !billing_type) {
      throw new Error('Missing required fields: ticket_id, billing_type')
    }

    // 6.5 Check Idempotency
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (idempotencyKey) {
        const { data: existingKey } = await adminClient
            .from('idempotency_keys')
            .select('*')
            .eq('key', idempotencyKey)
            .single();

        if (existingKey && new Date(existingKey.expires_at) > new Date()) {
            console.log(`V3: Idempotency Key Hit: ${idempotencyKey}`);
            return new Response(JSON.stringify(existingKey.response_body), {
                status: existingKey.response_status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    // 7. Fetch Ticket (Verify ownership)
    const { data: ticket, error: ticketError } = await adminClient
      .from('tickets')
      .select('*, events!inner(*)')
      .eq('id', ticket_id)
      .eq('buyer_user_id', user.id) // Ensure the user calling is the buyer
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket fetch error:', ticketError);
      throw new Error('Ticket not found or invalid');
    }

    // Verify status
    if (ticket.status !== 'reserved' && ticket.status !== 'pending') {
      throw new Error(`Ticket status invalid for payment: ${ticket.status}`);
    }

    // 7.5 Apply Coupon Logic (Server-Side Recalculation)
    const basePrice = Number(ticket.unit_price) * Number(ticket.quantity);
    let finalPrice = basePrice;
    let discountAmount = 0;
    let appliedCouponId = null;

    if (coupon_code) {
        const { data: coupon, error: couponError } = await adminClient
            .from('coupons')
            .select('*')
            .eq('code', coupon_code.toUpperCase())
            .eq('active', true)
            .single();

        if (couponError || !coupon) {
            throw new Error('Cupom inválido ou expirado');
        }

        // Validate Expiration
        if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
            throw new Error('Cupom expirado');
        }

        // Validate Max Uses
        if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
            throw new Error('Limite de uso do cupom atingido');
        }

        // Calculate Discount
        if (coupon.discount_type === 'percentage') {
            discountAmount = (basePrice * coupon.discount_value) / 100;
        } else {
            discountAmount = coupon.discount_value;
        }
        
        // Cap discount at base price
        if (discountAmount > basePrice) discountAmount = basePrice;
        
        finalPrice = basePrice - discountAmount;
        appliedCouponId = coupon.id;
        
        console.log(`V3: Coupon Applied: ${coupon.code} - Discount: ${discountAmount} - Final: ${finalPrice}`);
    } else {
        // Reset if no coupon provided (ensure clean state)
        finalPrice = basePrice;
        discountAmount = 0;
        appliedCouponId = null;
    }

    // Update Ticket with Final Price (Source of Truth)
    const { error: updateTicketError } = await adminClient
        .from('tickets')
        .update({
            total_price: finalPrice,
            discount_amount: discountAmount,
            coupon_id: appliedCouponId,
            updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

    if (updateTicketError) {
        throw new Error('Failed to update ticket price');
    }
    
    // Refresh ticket object locally
    ticket.total_price = finalPrice;

    // 8. Fetch Creator Profile (for name/cpf fallback)
    // const { data: creatorProfile } = await adminClient
    //   .from('profiles')
    //   .select('full_name, cpf')
    //   .eq('id', ticket.events.creator_id)
    //   .single();

    // 8.1 Fetch Buyer Profile (Primary source for CPF)
    const { data: buyerProfile } = await adminClient
      .from('profiles')
      .select('full_name, cpf, email, asaas_customer_id')
      .eq('id', user.id)
      .single();

    console.log(`V3: Buyer Profile: ${user.id} - CPF: ${buyerProfile?.cpf ? '***' : 'MISSING'} - Asaas ID: ${buyerProfile?.asaas_customer_id}`);
    
    // 9. Get Asaas Config
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.api_key) {
      throw new Error('Asaas configuration not found');
    }

    const { api_key: apiKey, env, wallet_id: platformWalletId, split_enabled, platform_fee_type, platform_fee_value } = config;
    const baseUrl = env === 'production' ? 'https://www.asaas.com/api/v3' : 'https://sandbox.asaas.com/api/v3';
    const headers = { 'access_token': apiKey, 'Content-Type': 'application/json' };

    // 10. Validate Organizer Account
    const { data: organizerAccount, error: orgAccountError } = await adminClient
      .from('organizer_asaas_accounts')
      .select('*')
      .eq('organizer_user_id', ticket.events.creator_id)
      .single();

    if (orgAccountError || !organizerAccount || organizerAccount.kyc_status !== 'approved') {
      throw new Error('Organizer not ready for payments');
    }

    // 11. Calculate Values (Surcharge Model)
    // ticket.total_price is the subtotal (ticket price - discounts)
    // We add the service fee on top of this value.
    const ticketPrice = Number(ticket.total_price);
    
    let serviceFee = 0;
    if (split_enabled) {
        if (platform_fee_type === 'percentage') {
            serviceFee = Number((ticketPrice * (Number(platform_fee_value) / 100)).toFixed(2));
        } else {
            serviceFee = Number(Number(platform_fee_value).toFixed(2));
        }
    }

    const totalToCharge = Number((ticketPrice + serviceFee).toFixed(2));
    const organizerValue = ticketPrice;

    console.log(`V3 Calculation: Ticket ${ticketPrice} + Fee ${serviceFee} = Total ${totalToCharge}`);

    // 12. Customer Info (Buyer Data ONLY)
    // STRICT RULE: Never use Organizer data for Customer creation.
    
    // Helper to sanitize CPF/CNPJ
    const sanitizeCpfCnpj = (value: string | null) => {
        if (!value) return '';
        return value.replace(/\D/g, '');
    };

    // Buyer Data Extraction
    const buyerEmail = buyerProfile?.email || user.email;
    const buyerName = buyerProfile?.full_name;
    const rawCpf = buyerProfile?.cpf;
    const buyerCpf = sanitizeCpfCnpj(rawCpf);

    // STRICT VALIDATION
    if (!buyerEmail) {
        throw new Error('Email do comprador é obrigatório.');
    }
    if (!buyerName) {
        throw new Error('Nome completo do comprador é obrigatório.');
    }
    if (!buyerCpf || (buyerCpf.length !== 11 && buyerCpf.length !== 14)) {
        throw new Error('CPF/CNPJ do comprador inválido ou não informado. Atualize seu perfil.');
    }

    // Check strict separation: Customer Email != Organizer Email
    if (buyerEmail === organizerAccount.asaas_account_email) {
        console.warn(`V3 Warning: Buyer Email matches Organizer Email (${buyerEmail}). This is only valid for self-testing.`);
    }

    const customerInfo = {
        name: buyerName,
        email: buyerEmail,
        cpfCnpj: buyerCpf,
        externalReference: user.id,
        notificationDisabled: false, // Ensure buyer receives Asaas emails
    };

    console.log(`V3: Preparing Asaas Customer for User ${user.id} (Email and CPF validated)`);

    // 13. Create/Find Customer in Asaas
    let customerId = '';
    
    // Check if we already have the customer ID in our database
    if (buyerProfile?.asaas_customer_id) {
        console.log(`V3: Using cached Asaas Customer ID: ${buyerProfile.asaas_customer_id}`);
        customerId = buyerProfile.asaas_customer_id;
    } else {
        // Search by email
        const searchRes = await fetch(`${baseUrl}/customers?email=${customerInfo.email}`, { headers });
        const searchData = await searchRes.json();
        
        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
            console.log(`V3: Found existing Asaas Customer ID by email: ${customerId}`);
        } else {
            // Create new customer
            const createCustomerRes = await fetch(`${baseUrl}/customers`, {
                method: 'POST',
                headers,
                body: JSON.stringify(customerInfo)
            });
            const newCustomer = await createCustomerRes.json();
            if (newCustomer.errors) {
                 throw new Error(`Customer Creation Error: ${newCustomer.errors[0].description}`);
            }
            customerId = newCustomer.id;
            console.log(`V3: Created new Asaas Customer ID: ${customerId}`);
        }

        // Update Profile with new Asaas Customer ID
        const { error: updateProfileError } = await adminClient
            .from('profiles')
            .update({ asaas_customer_id: customerId })
            .eq('id', user.id);
            
        if (updateProfileError) {
            console.error('V3 Error: Failed to update profile with Asaas Customer ID', updateProfileError);
        }
    }

    // 14. Prepare Payment Payload
    const paymentBody: any = {
        customer: customerId,
        billingType: billing_type.toUpperCase(),
        value: totalToCharge,
        dueDate: new Date().toISOString().split('T')[0], // Today
        description: `Ingresso: ${ticket.events.title} (R$ ${ticketPrice.toFixed(2)}) + Taxa (R$ ${serviceFee.toFixed(2)})`,
        externalReference: ticket.id,
    };

    // Handle Split
    const splitsToRecord = [];

    if (split_enabled) {
        const split = [];
        
        // 1. Organizer Split (Ticket Price)
        if (organizerAccount.asaas_account_id && organizerValue > 0) {
            const organizerSplit = { 
                walletId: organizerAccount.asaas_account_id, 
                fixedValue: organizerValue,
            };
            split.push(organizerSplit);
            
            splitsToRecord.push({
                recipient_type: 'organizer',
                recipient_user_id: ticket.events.creator_id,
                wallet_id: organizerAccount.asaas_account_id,
                amount: organizerValue
            });
        }

        // 2. Platform Split (Service Fee)
        // If platformWalletId is provided, send it explicitly. 
        // If not, Asaas keeps the remainder in the master account (implicit split).
        if (serviceFee > 0) {
             if (platformWalletId && platformWalletId !== organizerAccount.asaas_account_id) {
                 const platformSplit = {
                     walletId: platformWalletId,
                     fixedValue: serviceFee
                 };
                 split.push(platformSplit);

                 splitsToRecord.push({
                    recipient_type: 'platform',
                    recipient_user_id: null, // Platform
                    wallet_id: platformWalletId,
                    amount: serviceFee
                });
             } else {
                 // Implicit split to master account
                 console.log('V3: Platform Fee stays in Master Account (Implicit Split)');
                 
                 // Still record it in our database for accounting
                 splitsToRecord.push({
                    recipient_type: 'platform',
                    recipient_user_id: null, // Platform
                    wallet_id: 'MASTER_ACCOUNT', // Placeholder
                    amount: serviceFee
                });
             }
        }
        
        // Validation: Ensure we don't exceed total
        // Note: If using implicit split (no platform wallet), totalSplitValue < totalToCharge is VALID.
        // But if using explicit split (platform wallet present), they should match.
        const totalSplitValue = split.reduce((acc, item) => acc + item.fixedValue, 0);
        
        if (totalSplitValue > totalToCharge) {
            throw new Error(`Erro de cálculo no Split: Total Split (${totalSplitValue}) > Total Cobrado (${totalToCharge})`);
        }

        if (split.length > 0) {
            paymentBody.split = split;
            console.log(`V3 Split Configured:`, JSON.stringify(split));
        }
    }

    // 15. Create Payment
    const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentBody)
    });

    const paymentData = await paymentRes.json();
    
    if (paymentData.errors) {
        console.error('Asaas Payment Error:', paymentData.errors);
        throw new Error(`Asaas Payment Error: ${paymentData.errors[0].description}`);
    }

    // 16. Update Ticket Status
    await adminClient.from('tickets').update({ status: 'pending' }).eq('id', ticket.id);

    // 17. Record Payment
    const { data: paymentRecord } = await adminClient
        .from('payments')
        .insert({
            ticket_id: ticket.id,
            user_id: user.id, // Buyer ID
            organizer_user_id: ticket.events.creator_id,
            provider: 'asaas',
            external_payment_id: paymentData.id,
            payment_method: billing_type.toLowerCase(),
            value: totalToCharge,
            status: 'pending',
            payment_url: paymentData.invoiceUrl,
        })
        .select()
        .single();

    // 17.5 Record Payment Split (MANDATORY)
    if (splitsToRecord.length > 0 && paymentRecord) {
        console.log('V3: Recording Payment Splits in Database...');
        
        const splitRows = splitsToRecord.map(split => ({
            payment_id: paymentRecord.id,
            recipient_type: split.recipient_type,
            recipient_user_id: split.recipient_user_id,
            asaas_account_id: split.wallet_id,
            wallet_id: split.wallet_id,
            fee_type: 'fixed',
            fee_value: split.amount,
            value: split.amount,
            status: 'pending',
            split_rule: split
        }));

        const { error: splitError } = await adminClient
            .from('payment_splits')
            .insert(splitRows);
            
        if (splitError) {
             console.error('CRITICAL V3 ERROR: Failed to insert payment_splits', splitError);
             throw new Error('Falha crítica ao registrar divisão de pagamento. Contacte o suporte.');
        }
    }

    // 18. Handle PIX QR Code
    let pixQrCode = null;
    let pixQrCodeText = null;
    if (billing_type.toUpperCase() === 'PIX') {
        const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, { headers });
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage;
        pixQrCodeText = pixData.payload;

        if (paymentRecord) {
            await adminClient
                .from('payments')
                .update({ pix_qr_code: pixQrCodeText })
                .eq('id', paymentRecord.id);
        }
    }

    const responseBody = { 
        success: true,
        paymentId: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        pixQrCode,
        pixQrCodeText,
    };

    // Save Idempotency Key
    if (idempotencyKey) {
        await adminClient.from('idempotency_keys').insert({
            key: idempotencyKey,
            response_body: responseBody,
            response_status: 200,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
        });
    }

    return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
    });

  } catch (error: any) {
    console.error('Function Error:', error);
    
    if (error instanceof Response) {
      return error
    }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
