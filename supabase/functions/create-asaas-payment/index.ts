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
    // 1. Verify User Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid user token');
    }

    const { 
      user_id, 
      value, 
      description, 
      payment_method, // 'PIX', 'CREDIT_CARD', 'BOLETO'
      customer_info, // { name, email, cpfCnpj, ... }
      metadata
    } = await req.json();

    if (!value || !user_id) throw new Error('Missing required fields');

    // Enforce user_id match for security
    if (user.id !== user_id) {
      // Allow admins to create payments for others? For now, strict check.
      // If needed, check profile role here.
      throw new Error('Unauthorized: User ID mismatch');
    }

    // 2. Admin Client for Privileged Operations (Get Secrets, Write Payments)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Get Asaas Config
    const { data: config, error: configError } = await adminClient
      .rpc('get_decrypted_asaas_config')
      .single();

    if (configError || !config?.secret_key) {
      console.error('Config Error:', configError);
      throw new Error('Asaas configuration not found or invalid');
    }

    const { secret_key: apiKey, env } = config;
    const baseUrl = env === 'production' 
      ? 'https://api.asaas.com/api/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    const headers = {
        'access_token': apiKey,
        'Content-Type': 'application/json'
    };

    // 4. Create/Find Customer
    let customerId = '';
    
    // Try to find customer by email
    const searchRes = await fetch(`${baseUrl}/customers?email=${customer_info.email}`, { headers });
    const searchData = await searchRes.json();
    
    if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
    } else {
        // Create new customer
        const createCustomerRes = await fetch(`${baseUrl}/customers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(customer_info)
        });
        const newCustomer = await createCustomerRes.json();
        if (newCustomer.errors) throw new Error(`Customer Error: ${newCustomer.errors[0].description}`);
        customerId = newCustomer.id;
    }

    // 5. Create Payment
    const paymentBody = {
        customer: customerId,
        billingType: payment_method,
        value: value,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Next day
        description: description,
        externalReference: user_id, // Metadata for webhook
        postalService: false // Don't send postal mail
    };

    const paymentRes = await fetch(`${baseUrl}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentBody)
    });
    
    const paymentData = await paymentRes.json();
    if (paymentData.errors) throw new Error(`Payment Error: ${paymentData.errors[0].description}`);

    // 6. Get PIX QR Code if PIX
    let pixQrCode = null;
    let pixQrCodeText = null;
    if (payment_method === 'PIX') {
        const pixRes = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, { headers });
        const pixData = await pixRes.json();
        pixQrCode = pixData.encodedImage;
        pixQrCodeText = pixData.payload;
    }

    // 7. Store in DB
    const { error: dbError } = await adminClient
        .from('payments')
        .insert({
            user_id: user_id,
            provider: 'asaas',
            external_payment_id: paymentData.id,
            value: value,
            status: 'pending',
            payment_method: payment_method.toLowerCase(),
            created_at: new Date().toISOString()
        });

    if (dbError) {
        console.error('Database Error:', dbError);
        // Don't fail the request if DB insert fails, but log it. 
        // Ideally we should rollback or retry.
    }

    return new Response(JSON.stringify({ 
        success: true,
        paymentId: paymentData.id,
        paymentUrl: paymentData.invoiceUrl, // Asaas Invoice URL
        invoiceUrl: paymentData.invoiceUrl,
        pixQrCode,
        pixQrCodeText,
        status: paymentData.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
