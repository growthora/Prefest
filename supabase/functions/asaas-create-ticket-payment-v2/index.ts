
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user } = await requireAuth(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';


    const { ticket_id, billing_type, card_data, installments } = await req.json();

    if (!ticket_id || !billing_type) {
      throw new Error('Missing required fields');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from('tickets')
      .select('*, events!inner(*), ticket_types!inner(*)')
      .eq('id', ticket_id)
      .eq('buyer_user_id', user.id) // Ensure ownership
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket fetch error:', ticketError);
      throw new Error('Ticket not found or invalid');
    }

    // NEW: Check Event Purchase Availability (Global Blockade)
    const { data: isAvailable, error: validationError } = await adminClient
      .rpc('check_event_purchase_availability', { p_event_id: ticket.events.id });
    
    if (validationError || !isAvailable) {
      throw new Error(validationError?.message || 'Este evento já foi realizado ou as vendas estão encerradas.');
    }

    // Verify status
    if (ticket.status !== 'reserved' && ticket.status !== 'pending') {
      throw new Error('Ticket status invalid for payment');
    }
    
    // Separate query for creator profile to avoid join complexity issues
    const { data: creatorProfile, error: creatorError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', ticket.events.creator_id)
      .single();
      
    if (creatorError) {
        throw new Error('Event creator not found');
    }

    // 2. Get Asaas Config
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.api_key) {
      throw new Error('Asaas configuration not found');
    }

    const { api_key: apiKey, environment: env, wallet_id: platformWalletId, split_enabled, platform_fee_type, platform_fee_value } = config;
    const baseUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
    const headers = { 'access_token': apiKey, 'Content-Type': 'application/json' };

    // 3. Validate Organizer Account
    const { data: organizerAccount, error: orgAccountError } = await adminClient
      .from('organizer_asaas_accounts')
      .select('*')
      .eq('organizer_user_id', ticket.events.creator_id)
      .single();

    if (orgAccountError || !organizerAccount || organizerAccount.kyc_status !== 'approved') {
      throw new Error('Organizer not ready for payments');
    }

    // 4. Calculate Values
    const totalPrice = Number(ticket.total_price);
    
    let platformFee = 0;
    if (split_enabled) {
        if (platform_fee_type === 'percentage') {
            platformFee = Number((totalPrice * (Number(platform_fee_value) / 100)).toFixed(2));
        } else {
            platformFee = Number(Number(platform_fee_value).toFixed(2));
        }
    }

    const organizerValue = Number((totalPrice - platformFee).toFixed(2));

    // 5. Customer Info (Buyer Data ONLY - FIXED)
    // STRICT RULE: Never use Organizer data for Customer creation.
    
    // Fetch Buyer Profile for correct data
    const { data: buyerProfile, error: buyerError } = await adminClient
      .from('profiles')
      .select('full_name, cpf, email')
      .eq('id', user.id)
      .single();

    if (buyerError || !buyerProfile) {
        throw new Error('Buyer profile not found. Please complete your registration.');
    }

    const buyerEmail = buyerProfile.email || user.email;
    const buyerName = buyerProfile.full_name;
    const rawCpf = buyerProfile.cpf;
    const buyerCpf = rawCpf ? rawCpf.replace(/\D/g, '') : '';

    // STRICT VALIDATION
    if (!buyerEmail) throw new Error('Email do comprador é obrigatório.');
    if (!buyerName) throw new Error('Nome completo do comprador é obrigatório.');
    if (!buyerCpf || (buyerCpf.length !== 11 && buyerCpf.length !== 14)) {
        throw new Error('CPF/CNPJ do comprador inválido ou não informado.');
    }

    // Check strict separation
    if (buyerEmail === organizerAccount.asaas_account_email) {
        console.warn(`V2 Warning: Buyer Email matches Organizer Email (${buyerEmail}). Self-testing?`);
    }

    const customerInfo = {
        name: buyerName,
        email: buyerEmail,
        cpfCnpj: buyerCpf,
        externalReference: user.id,
        notificationDisabled: false
    };

    console.log(`V2 Customer Info Prepared: ${JSON.stringify(customerInfo)}`);

    // 6. Create Customer in Asaas
    let customerId = '';
    const searchRes = await fetch(`${baseUrl}/customers?email=${customerInfo.email}`, { headers });
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
    } else {
        const createCustomerRes = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(customerInfo)
        });
        const newCustomer = await createCustomerRes.json();
        if (newCustomer.errors) throw new Error(`Customer Error: ${newCustomer.errors[0].description}`);
        customerId = newCustomer.id;
    }

    // 7. Payment Payload
    const split = [];
    if (split_enabled && platformWalletId) {
        if (platformFee > 0) split.push({ walletId: platformWalletId, fixedValue: platformFee });
        if (organizerValue > 0) split.push({ walletId: organizerAccount.asaas_account_id, fixedValue: organizerValue });
    } else {
        // Fallback logic
        if (platformFee > 0) split.push({ walletId: platformWalletId, fixedValue: platformFee });
        if (organizerValue > 0) split.push({ walletId: organizerAccount.asaas_account_id, fixedValue: organizerValue });
    }

    const paymentBody: any = {
        customer: customerId,
        billingType: billing_type,
        value: totalPrice,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Ingresso: ${ticket.events.title} - ${ticket.ticket_types.name} (x${ticket.quantity})`,
        externalReference: ticket.id,
        postalService: false,
        split: split
    };

    if (billing_type === 'CREDIT_CARD' || billing_type === 'DEBIT_CARD') {
        if (!card_data) throw new Error('Card data required');
        paymentBody.creditCard = {
            holderName: card_data.holderName,
            number: card_data.number,
            expiryMonth: card_data.expiryMonth,
            expiryYear: card_data.expiryYear,
            ccv: card_data.ccv
        };
        paymentBody.creditCardHolderInfo = {
            name: customerInfo.name,
            email: customerInfo.email,
            cpfCnpj: customerInfo.cpfCnpj,
            postalCode: '00000000',
            addressNumber: '0',
            phone: '00000000000'
        };
        if (installments > 1) {
             paymentBody.installmentCount = installments;
             paymentBody.installmentValue = totalPrice / installments;
        }
    }

    // 8. Execute Payment
    const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentBody)
    });
    
    const paymentData = await paymentRes.json();
    if (paymentData.errors) {
        throw new Error(`Asaas Payment Error: ${paymentData.errors[0].description}`);
    }

    // 9. Update Ticket Status
    await adminClient.from('tickets').update({ status: 'pending' }).eq('id', ticket.id);

    // 10. Record Payment
    const { data: paymentRecord } = await adminClient
        .from('payments')
        .insert({
            ticket_id: ticket.id,
            organizer_user_id: ticket.events.creator_id,
            provider: 'asaas',
            external_payment_id: paymentData.id,
            billing_type: billing_type.toLowerCase(),
            value_total: totalPrice,
            status: 'pending',
            invoice_url: paymentData.invoiceUrl,
        })
        .select()
        .single();

    // 11. Handle PIX
    let pixQrCode = null;
    let pixQrCodeText = null;
    if (billing_type === 'PIX') {
        const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, { headers });
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage;
        pixQrCodeText = pixData.payload;

        if (paymentRecord) {
            await adminClient
                .from('payments')
                .update({ pix_qr_code: pixQrCode, pix_copy_paste: pixQrCodeText })
                .eq('id', paymentRecord.id);
        }
    }

    return new Response(JSON.stringify({ 
        success: true,
        paymentId: paymentData.id,
        invoiceUrl: paymentData.invoiceUrl,
        pixQrCode,
        pixQrCodeText,
        status: paymentData.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
