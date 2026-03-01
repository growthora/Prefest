
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS (Strictly first)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Validate Authorization Header
    const authHeader = req.headers.get('Authorization')
    console.log("V3 Debug: Received Auth Header:", authHeader ? authHeader.substring(0, 50) + "..." : "MISSING");

    if (!authHeader) {
      console.error("V3 Debug: Missing Authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Initialize Supabase Client for User Validation (using ANON KEY)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 4. Verify User (This checks if the JWT is valid and not expired)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('V3 Debug: Auth Validation Failed:', JSON.stringify(userError))
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session', details: userError }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 5. Initialize Admin Client for Privileged Operations (Service Role)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 6. Parse Request Body
    const { ticket_id, billing_type } = await req.json()

    if (!ticket_id || !billing_type) {
      throw new Error('Missing required fields: ticket_id, billing_type')
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

    // 8. Fetch Creator Profile (for name/cpf fallback)
    const { data: creatorProfile, error: creatorError } = await adminClient
      .from('profiles')
      .select('full_name, cpf')
      .eq('id', ticket.events.creator_id)
      .single();

    // 8.1 Fetch Buyer Profile (Primary source for CPF)
    const { data: buyerProfile } = await adminClient
      .from('profiles')
      .select('full_name, cpf, email, asaas_customer_id')
      .eq('id', user.id)
      .single();

    console.log(`V3: Buyer Profile: ${user.id} - CPF: ${buyerProfile?.cpf} - Asaas ID: ${buyerProfile?.asaas_customer_id}`);
    console.log(`V3: Creator Profile: ${ticket.events.creator_id} - CPF: ${creatorProfile?.cpf}`);

    // 9. Get Asaas Config
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.api_key) {
      throw new Error('Asaas configuration not found');
    }

    const { api_key: apiKey, env, wallet_id: platformWalletId, split_enabled, platform_fee_type, platform_fee_value } = config;
    const baseUrl = env === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
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
    
    let platformFee = 0;
    if (split_enabled) {
        if (platform_fee_type === 'percentage') {
            platformFee = Number((totalPrice * (Number(platform_fee_value) / 100)).toFixed(2));
        } else {
            platformFee = Number(Number(platform_fee_value).toFixed(2));
        }
    }

    const organizerValue = Number((totalPrice - platformFee).toFixed(2));

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
    // (Optional warning, but allowed if organizer buys their own ticket for testing)
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

    console.log(`V3 Customer Info Prepared: ${JSON.stringify(customerInfo)}`);

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
        } else {
            console.log(`V3: Updated profile ${user.id} with Asaas Customer ID ${customerId}`);
        }
    }

    // 14. Prepare Payment Payload
    const paymentBody: any = {
        customer: customerId,
        billingType: billing_type.toUpperCase(),
        value: totalPrice,
        dueDate: new Date().toISOString().split('T')[0], // Today
        description: `Ingresso: ${ticket.events.title}`,
        externalReference: ticket.id,
    };

    // Handle Split
    let splitConfigForDb = null;

    // FIX: Do NOT add platformWalletId to split array if we are the creator (Master Account).
    // The remaining value (Total - Split) stays with the Master Account automatically.
    if (split_enabled && organizerAccount.asaas_account_id) {
        // Prevent splitting to the Master Account itself (which would cause "Não é permitido split para sua própria carteira")
        if (organizerAccount.asaas_account_id === platformWalletId) {
            console.log(`V3 Split Skipped: Organizer Wallet (${organizerAccount.asaas_account_id}) is the same as Platform Wallet. Value stays fully in Master Account.`);
        } else {
            const split = [];
            
            // Only split to the Organizer. The rest (platformFee) stays in Master Account.
            if (organizerValue > 0) {
                const splitItem = { 
                    walletId: organizerAccount.asaas_account_id, 
                    fixedValue: organizerValue,
                    percentualValue: undefined // Ensure we use fixedValue
                };
                split.push(splitItem);
                
                // Store for DB insert
                splitConfigForDb = splitItem;
            }
            
            if (split.length > 0) {
                // @ts-ignore: dynamic property
                paymentBody.split = split;
                console.log(`V3 Split Configured: Total ${totalPrice} -> Organizer ${organizerValue} (Wallet: ${organizerAccount.asaas_account_id}) | Platform Keeps: ${(totalPrice - organizerValue).toFixed(2)}`);
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

    // 17.5 Record Payment Split (MANDATORY)
    if (splitConfigForDb && paymentRecord) {
        console.log('V3: Recording Payment Split in Database...');
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
             console.error('CRITICAL V3 ERROR: Failed to insert payment_splits', splitError);
             throw new Error('Falha crítica ao registrar divisão de pagamento. Contacte o suporte.');
        } else {
             console.log('V3: Payment Split recorded successfully.');
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
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
    });

  } catch (error) {
    console.error('Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
})
