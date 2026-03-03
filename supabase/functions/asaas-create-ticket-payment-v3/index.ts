import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  // 1. Handle CORS (Strictly first)
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req)

  try {
    // 2. Validate Authorization Header & Verify User using requireAuth
    // console.log(`[asaas-create-ticket-payment-v3] Request received: ${req.method} ${req.url}`);
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
      // console.error('Rate Limit Check Error:', rateLimitError);
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
            // console.log(`V3: Idempotency Key Hit: ${idempotencyKey}`);
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
      // console.error('Ticket fetch error:', ticketError);
      throw new Error('Ticket not found or invalid');
    }

    // Verify status
    if (ticket.status !== 'reserved' && ticket.status !== 'pending') {
      throw new Error(`Ticket status invalid for payment: ${ticket.status}`);
    }

    // 9. Get Asaas Config
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.api_key) {
      throw new Error('Asaas configuration not found');
    }

    const {
      api_key: rawApiKey,
      env,
      wallet_id: platformWalletId,
      split_enabled,
      platform_fee_type,
      platform_fee_value
    } = config;
    const apiKey = String(rawApiKey || '').trim();
    const runtimeEnv = String(env || (config as any).environment || 'sandbox').toLowerCase();

    if (!apiKey) {
      throw new Error('Asaas API key is empty');
    }

    // 7.5 Apply Coupon Logic (Server-Side Recalculation)
    const basePrice = Number(ticket.unit_price) * Number(ticket.quantity);
    let serviceFee = 0;
    
    // Calculate Service Fee (Taxa de Serviço) - FIXED: 10% Hardcoded as requested
    // This overrides database configuration to ensure consistency with frontend
    serviceFee = (basePrice * 10) / 100;
    /*
    if (platform_fee_type === 'percentage') {
        serviceFee = (basePrice * (Number(platform_fee_value) || 10)) / 100;
    } else {
        serviceFee = Number(platform_fee_value) || 0;
    }
    */

    // Ensure service fee is at least 0
    serviceFee = Math.max(0, serviceFee);

    let finalPrice = basePrice + serviceFee;
    let discountAmount = 0;
    let appliedCouponId = null;

    if (coupon_code) {
        try {
            // Internal Coupon Logic (Replica of CouponService)
            const now = new Date().toISOString();
            
            // 1. Find and validate coupon
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

            // 2. Check usage limit
            if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
                 throw new Error('Cupom esgotado');
            }

            // 3. Calculate discount
            let calculatedDiscount = 0;
            if (coupon.discount_type === 'percentage') {
                calculatedDiscount = (basePrice * coupon.discount_value) / 100;
            } else {
                calculatedDiscount = coupon.discount_value;
            }
            
            // Cap discount
            calculatedDiscount = Math.min(calculatedDiscount, basePrice);
            const calculatedFinalPrice = basePrice - calculatedDiscount;

            // 4. Record usage
            const { data: usage, error: usageError } = await adminClient
                .from('coupon_usage')
                .insert({
                    coupon_id: coupon.id,
                    user_id: user.id,
                    event_id: ticket.event_id,
                    discount_applied: calculatedDiscount,
                })
                .select()
                .single();

            if (usageError) {
                 // console.error('Coupon usage insert error:', usageError);
                 throw new Error('Erro ao processar cupom');
            }

            // 5. Update usage count
            await adminClient
                .from('coupons')
                .update({ current_uses: coupon.current_uses + 1 })
                .eq('id', coupon.id);

            discountAmount = calculatedDiscount;
            finalPrice = calculatedFinalPrice + serviceFee; // Service fee is added on top of discounted price? 
            // Wait, logic at line 123 was: let finalPrice = basePrice + serviceFee;
            // If discount applies to basePrice, then finalPrice = (basePrice - discount) + serviceFee.
            // Yes.
            
            appliedCouponId = usage.coupon_id;
            // console.log(`V3: Coupon Applied: ${coupon_code} - Discount: ${discountAmount} - Final: ${finalPrice}`);

        } catch (couponErr: any) {
            // console.warn(`V3: Coupon Error: ${couponErr.message}`);
            return new Response(JSON.stringify({ error: `Coupon Error: ${couponErr.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }
    
    // Round to 2 decimals
    finalPrice = Number(finalPrice.toFixed(2));
    serviceFee = Number(serviceFee.toFixed(2));
    discountAmount = Number(discountAmount.toFixed(2));

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

    // console.log(`V3: Buyer Profile: ${user.id} - CPF: ${buyerProfile?.cpf ? '***' : 'MISSING'} - Asaas ID: ${buyerProfile?.asaas_customer_id}`);
    
    // Config already fetched above (Step 9 moved up)
    const baseUrl = runtimeEnv === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
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

    // 11. Calculate Values
    const totalPrice = Number(ticket.total_price);
    
    // Platform Fee is the Service Fee calculated earlier
    let platformFee = serviceFee;

    // Organizer Value = Total - Platform Fee
    // Which equals: (Base + Fee - Discount) - Fee = Base - Discount
    const organizerValue = Number((totalPrice - platformFee).toFixed(2));
    
    // console.log(`V3 Financials: Base ${basePrice} | Fee ${serviceFee} | Discount ${discountAmount} | Total ${totalPrice} | Org ${organizerValue}`);

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
        // console.warn(`V3 Warning: Buyer Email matches Organizer Email (${buyerEmail}). This is only valid for self-testing.`);
    }

    const customerInfo = {
        name: buyerName,
        email: buyerEmail,
        cpfCnpj: buyerCpf,
        externalReference: user.id,
        notificationDisabled: false, // Ensure buyer receives Asaas emails
    };

    // console.log(`V3: Preparing Asaas Customer for User ${user.id} (Email and CPF validated)`);

    // 13. Create/Find Customer in Asaas
    let customerId = '';
    
    // Check if we already have the customer ID in our database
    if (buyerProfile?.asaas_customer_id) {
        // console.log(`V3: Using cached Asaas Customer ID: ${buyerProfile.asaas_customer_id}`);
        customerId = buyerProfile.asaas_customer_id;
    } else {
        // Search by email
        const searchRes = await fetch(`${baseUrl}/customers?email=${customerInfo.email}`, { headers });
        const searchData = await searchRes.json();
        
        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
            // console.log(`V3: Found existing Asaas Customer ID by email: ${customerId}`);
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
            // console.log(`V3: Created new Asaas Customer ID: ${customerId}`);
        }

        // Update Profile with new Asaas Customer ID
        const { error: updateProfileError } = await adminClient
            .from('profiles')
            .update({ asaas_customer_id: customerId })
            .eq('id', user.id);
            
        if (updateProfileError) {
            // console.error('V3 Error: Failed to update profile with Asaas Customer ID', updateProfileError);
        }
    }

    // 14. Prepare Payment Payload
    // Format description to include fee breakdown
    let description = `Ingresso: ${ticket.events.title} (R$ ${basePrice.toFixed(2)})`;
    if (serviceFee > 0) {
        description += ` + Taxa de serviço (R$ ${serviceFee.toFixed(2)})`;
    }
    if (discountAmount > 0) {
        description += ` - Desconto (R$ ${discountAmount.toFixed(2)})`;
    }

    const paymentBody: any = {
        customer: customerId,
        billingType: billing_type.toUpperCase(),
        value: totalPrice,
        dueDate: new Date().toISOString().split('T')[0], // Today
        description: description,
        externalReference: ticket.id,
    };

    // Handle Split
    let splitConfigForDb = null;

    if (split_enabled && organizerAccount.asaas_account_id) {
        // Prevent splitting to the Master Account itself
        if (organizerAccount.asaas_account_id === platformWalletId) {
            // console.log(`V3 Split Skipped: Organizer Wallet (${organizerAccount.asaas_account_id}) is the same as Platform Wallet.`);
        } else {
            const split = [];
            
            // Only split to the Organizer. The rest (platformFee) stays in Master Account.
            if (organizerValue > 0) {
                const splitItem = { 
                    walletId: organizerAccount.asaas_account_id, 
                    fixedValue: organizerValue,
                    percentualValue: undefined
                };
                split.push(splitItem);
                
                // Store for DB insert
                splitConfigForDb = splitItem;
            }
            
            if (split.length > 0) {
                // @ts-ignore: dynamic property
                paymentBody.split = split;
                // console.log(`V3 Split Configured: Total ${totalPrice} -> Organizer ${organizerValue}`);
            }
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
        // console.error('Asaas Payment Error:', paymentData.errors);
        throw new Error(`Asaas Payment Error: ${paymentData.errors[0].description}`);
    }

    // 16. Update Ticket Status
    await adminClient.from('tickets').update({ status: 'pending' }).eq('id', ticket.id);

    // 17. Record Payment
    const { data: paymentRecord, error: paymentError } = await adminClient
        .from('payments')
        .insert({
            ticket_id: ticket.id,
            user_id: user.id, // Buyer ID
            organizer_user_id: ticket.events.creator_id,
            provider: 'asaas',
            external_payment_id: paymentData.id,
            payment_method: billing_type.toLowerCase(),
            value: totalPrice,
            status: 'pending',
            payment_url: paymentData.invoiceUrl,
        })
        .select()
        .single();

    if (paymentError) {
        // console.error('CRITICAL V3 ERROR: Failed to insert payment', paymentError);
        throw new Error('Falha ao registrar pagamento no sistema. Contacte o suporte.');
    }

    // 17.5 Record Payment Split (MANDATORY)
    if (splitConfigForDb && paymentRecord) {
        // console.log('V3: Recording Payment Split in Database...');
        const { error: splitError } = await adminClient
            .from('payment_splits')
            .insert({
                payment_id: paymentRecord.id,
                recipient_type: 'organizer',
                recipient_user_id: ticket.events.creator_id,
                asaas_account_id: splitConfigForDb.walletId,
                wallet_id: splitConfigForDb.walletId,
                fee_type: 'fixed',
                fee_value: splitConfigForDb.fixedValue,
                value: splitConfigForDb.fixedValue,
                status: 'pending',
                split_rule: splitConfigForDb
            });
            
        if (splitError) {
             // console.error('CRITICAL V3 ERROR: Failed to insert payment_splits', splitError);
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
                .update({ pix_qr_code: pixQrCodeText }) // Saving CopyPaste code in pix_qr_code column as it's more useful
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
    // console.error('V3 Payment Process Error:', error);
    
    if (error instanceof Response) {
      return error
    }

    // Return specific status codes based on error type if possible, or 400/500
    const status = error.message?.includes('Unauthorized') ? 401 
                 : error.message?.includes('Access denied') ? 403
                 : 400;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status
    });
  }
})
