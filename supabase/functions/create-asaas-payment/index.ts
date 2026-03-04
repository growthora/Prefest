
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Verify User Authentication
    // console.log('Function started');
    const { user } = await requireAuth(req);
    // console.log('User authenticated:', user.id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const { 
      event_id, 
      ticket_type_id, 
      quantity, 
      billing_type, // 'PIX', 'CREDIT_CARD', 'BOLETO', 'DEBIT_CARD'
      card_data, // { holderName, number, expiryMonth, expiryYear, ccv } (optional)
      customer_info, // { name, email, cpfCnpj, ... }
      installments, // Optional
      metadata, // Optional metadata (e.g. singleMode)
    } = await req.json();

    if (!event_id || !ticket_type_id || !quantity || !billing_type || !customer_info) {
        throw new Error('Missing required fields');
    }

    // 2. Admin Client for Privileged Operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Get Asaas Config (Platform Config)
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.api_key) {
      // console.error('Config Error:', configError);
      throw new Error('Asaas configuration not found or invalid');
    }

    const { api_key: rawApiKey, wallet_id: platformWalletId, split_enabled, platform_fee_type, platform_fee_value } = config;
    const apiKey = String(rawApiKey || '').trim();
    const env = String(config.env || config.environment || 'sandbox').toLowerCase();
    if (!apiKey) {
      throw new Error('Asaas API key is empty');
    }
    const baseUrl = env === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    const headers = {
        'access_token': apiKey,
        'Content-Type': 'application/json; charset=utf-8'
    };

    // 4. Fetch Event & Organizer
    const { data: event, error: eventError } = await adminClient
        .from('events')
        .select('*, creator_id, profiles!creator_id(*)')
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

    // 5. Fetch Ticket Type
    const { data: ticketType, error: ticketError } = await adminClient
        .from('ticket_types')
        .select('*')
        .eq('id', ticket_type_id)
        .single();

    if (ticketError || !ticketType) throw new Error('Ticket type not found');
    
    // Validate quantity
    if (ticketType.quantity_available - ticketType.quantity_sold < quantity) {
        throw new Error('Ingressos esgotados para este tipo');
    }

    // 6. Validate Organizer Asaas Account
    const { data: organizerAccount, error: orgAccountError } = await adminClient
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', event.creator_id)
        .single();

    if (orgAccountError || !organizerAccount) {
        throw new Error('ORGANIZER_NOT_READY_FOR_PAYMENTS: Organizador sem conta Asaas vinculada');
    }

    if (!organizerAccount.is_active || organizerAccount.kyc_status !== 'approved') {
        throw new Error('ORGANIZER_NOT_READY_FOR_PAYMENTS: Conta Asaas do organizador pendente de aprovaÃ§Ã£o');
    }

    // Check strict separation
    if (customer_info.email === organizerAccount.asaas_account_email) {
        // console.warn(`V2 Warning: Buyer Email matches Organizer Email (${customer_info.email}). Self-testing?`);
    }

    // 7. Calculate Values & Split
    const unitPrice = Number(ticketType.price);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    
    let platformFee = 0;
    if (split_enabled) {
        if (platform_fee_type === 'percentage') {
            platformFee = Number((totalPrice * (Number(platform_fee_value) / 100)).toFixed(2));
        } else {
            platformFee = Number(Number(platform_fee_value).toFixed(2));
        }
    }

    const organizerValue = Number((totalPrice - platformFee).toFixed(2));

    // Split Payload
    const split = [];
    if (split_enabled && platformWalletId) {
        // Platform Part
        if (platformFee > 0) {
            split.push({
                walletId: platformWalletId,
                fixedValue: platformFee,
                // percent: platform_fee_type === 'percentage' ? Number(platform_fee_value) : undefined
            });
        }
        
        // Organizer Part
        if (organizerValue > 0) {
            split.push({
                walletId: organizerAccount.asaas_account_id,
                fixedValue: organizerValue,
                // percent: platform_fee_type === 'percentage' ? (100 - Number(platform_fee_value)) : undefined
            });
        }
    } else {
        // Fallback or Force Split
        if (!platformWalletId) throw new Error('Platform Wallet ID missing in config');
        
        if (platformFee > 0) {
            split.push({
                walletId: platformWalletId,
                fixedValue: platformFee
            });
        }
        if (organizerValue > 0) {
            split.push({
                walletId: organizerAccount.asaas_account_id,
                fixedValue: organizerValue
            });
        }
    }

    // 8. Create Customer in Asaas (if needed)
    let customerId = '';
    const searchRes = await fetch(`${baseUrl}/customers?email=${customer_info.email}`, { headers });
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
    } else {
        const createCustomerRes = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(customer_info)
        });
        const newCustomer = await createCustomerRes.json();
        if (newCustomer.errors) throw new Error(`Customer Error: ${newCustomer.errors[0].description}`);
        customerId = newCustomer.id;
    }

    // 9. Prepare Payment Payload
    const paymentBody: any = {
        customer: customerId,
        billingType: billing_type,
        value: totalPrice,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Ingresso: ${event.title} - ${ticketType.name} (x${quantity})`,
        externalReference: user.id, // We'll update this later or use ticket ID
        postalService: false,
        split: split
    };

    if (billing_type === 'CREDIT_CARD' || billing_type === 'DEBIT_CARD') {
        if (!card_data) throw new Error('Card data is required for Credit/Debit Card payments');
        paymentBody.creditCard = {
            holderName: card_data.holderName,
            number: card_data.number,
            expiryMonth: card_data.expiryMonth,
            expiryYear: card_data.expiryYear,
            ccv: card_data.ccv
        };
        paymentBody.creditCardHolderInfo = {
            name: customer_info.name,
            email: customer_info.email,
            cpfCnpj: customer_info.cpfCnpj,
            postalCode: customer_info.postalCode || '00000000',
            addressNumber: customer_info.addressNumber || '0',
            phone: customer_info.phone || '00000000000'
        };
        if (installments && installments > 1) {
             paymentBody.installmentCount = installments;
             paymentBody.installmentValue = totalPrice / installments;
        }
    }

    // 10. Database Operations (Transaction-like)
    // Create Ticket
    const { data: ticket, error: ticketDbError } = await adminClient
        .from('tickets')
        .insert({
            event_id: event_id,
            buyer_user_id: user.id,
            ticket_type_id: ticket_type_id,
            quantity: quantity,
            unit_price: unitPrice,
            total_price: totalPrice,
            status: 'pending',
            metadata: metadata // Save metadata (e.g. singleMode)
        })
        .select()
        .single();

    if (ticketDbError || !ticket) {
        // console.error('Ticket Creation Error:', ticketDbError);
        throw new Error('Failed to create ticket record');
    }

    // 11. Create Payment in Asaas
    // Update externalReference to be the ticket ID for easier tracking
    paymentBody.externalReference = ticket.id;

    const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentBody)
    });
    
    const paymentData = await paymentRes.json();
    if (paymentData.errors) {
        // Rollback ticket creation?
        await adminClient.from('tickets').delete().eq('id', ticket.id);
        throw new Error(`Asaas Error: ${paymentData.errors[0].description}`);
    }

    // 12. Create Payment Record in DB
    const { data: paymentRecord, error: paymentDbError } = await adminClient
        .from('payments')
        .insert({
            ticket_id: ticket.id,
            user_id: user.id,
            organizer_user_id: event.creator_id,
            provider: 'asaas',
            external_payment_id: paymentData.id,
            payment_method: billing_type.toLowerCase(),
            value: totalPrice,
            status: 'pending',
            payment_url: paymentData.invoiceUrl,
            // We'll fill PIX data later if applicable
        })
        .select()
        .single();

    if (paymentDbError) {
        // console.error('Payment DB Error:', paymentDbError);
        // Should handle this better, but for now log it.
    }

    // 13. Create Payment Splits in DB
    if (paymentRecord) {
        const splitInserts = [];
        
        // Platform Split
        splitInserts.push({
            payment_id: paymentRecord.id,
            recipient_type: 'platform',
            asaas_account_id: platformWalletId,
            fee_type: platform_fee_type,
            fee_value: Number(platform_fee_value),
            value: platformFee,
            status: 'pending'
        });

        // Organizer Split
        splitInserts.push({
            payment_id: paymentRecord.id,
            recipient_type: 'organizer',
            recipient_user_id: event.creator_id,
            asaas_account_id: organizerAccount.asaas_account_id,
            value: organizerValue,
            status: 'pending'
        });

        await adminClient.from('payment_splits').insert(splitInserts);
    }

    // 14. Get PIX QR Code if PIX
    let pixQrCode = null;
    let pixQrCodeText = null;
    if (billing_type === 'PIX') {
        const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, { headers });
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage;
        pixQrCodeText = pixData.payload;

        // Update payment record with PIX data
        if (paymentRecord) {
            await adminClient
                .from('payments')
                .update({ pix_qr_code: pixQrCodeText || pixQrCode })
                .eq('id', paymentRecord.id);
        }
    }

    return new Response(JSON.stringify({ 
        success: true,
        paymentId: paymentData.id,
        ticketId: ticket.id,
        invoiceUrl: paymentData.invoiceUrl,
        pixQrCode,
        pixQrCodeText,
        status: paymentData.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    // console.error('Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
