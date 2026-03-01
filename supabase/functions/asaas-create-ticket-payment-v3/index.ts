
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
      .select('full_name, cpf, email')
      .eq('id', user.id)
      .single();

    console.log(`V3: Buyer Profile: ${user.id} - CPF: ${buyerProfile?.cpf}`);
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

    // 12. Customer Info (Organizer Email Strategy)
    // Priority: 1. asaas_account_email (DB), 2. Fallback
    const organizerEmail = organizerAccount.asaas_account_email || 'pagamentos@prefest.com.br';
    
    // Helper to sanitize CPF/CNPJ
    const sanitizeCpfCnpj = (value: string | null) => {
        if (!value) return '';
        return value.replace(/\D/g, '');
    };

    // CPF Strategy: Buyer (Priority)
    let cpfCnpj = '';

    // 1. Try Buyer Profile
    if (buyerProfile && buyerProfile.cpf) {
        cpfCnpj = sanitizeCpfCnpj(buyerProfile.cpf);
    }

    // Validate CPF/CNPJ
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
        console.warn(`CPF/CNPJ missing for buyer ${user.id}`);
        throw new Error(`CPF do comprador obrigatório. Por favor, preencha seus dados corretamente antes de finalizar a compra.`);
    }

    const customerInfo = {
        name: buyerProfile?.full_name || organizerAccount.asaas_account_name || 'Cliente Prefest',
        email: organizerEmail, // Using Organizer Email to centralize notifications
        cpfCnpj: cpfCnpj,
        externalReference: user.id
    };

    // 13. Create/Find Customer in Asaas
    let customerId = '';
    // Search by email
    const searchRes = await fetch(`${baseUrl}/customers?email=${customerInfo.email}`, { headers });
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
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
                split.push({ 
                    walletId: organizerAccount.asaas_account_id, 
                    fixedValue: organizerValue,
                    percentualValue: undefined // Ensure we use fixedValue
                });
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
