
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    console.log(`[asaas-create-or-connect-organizer] Auth Header Present: ${!!authHeader}`);

    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
        console.error('[asaas-create-or-connect-organizer] Auth Error:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), { status: 401, headers: corsHeaders })
    }
    
    console.log(`[asaas-create-or-connect-organizer] User Authenticated: ${user.id}`);

    const { name, email, cpfCnpj, mobilePhone, address, addressNumber, complement, province, postalCode } = await req.json()

    // Basic Validation
    if (!name || !email || !cpfCnpj || !mobilePhone || !address || !postalCode) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders })
    }

    // 2. Get Asaas Config (Securely)
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError || !config || !config.api_key) {
        return new Response(JSON.stringify({ error: 'Asaas configuration error' }), { status: 500, headers: corsHeaders })
    }

    const API_URL = config.environment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3'

    // 3. Check if account already exists in Database
    const { data: existingAccount } = await adminClient
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', user.id)
        .single()

    if (existingAccount) {
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Account already connected',
            account: existingAccount
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. Check if account already exists in Asaas (by CPF/CNPJ)
    // This handles the "Already has an Asaas account" scenario for subaccounts
    let asaasAccountId = null;
    let asaasWalletId = null;
    let isNewAccount = false;

    console.log(`[asaas-create-or-connect-organizer] Searching for existing Asaas account for CPF/CNPJ: ${cpfCnpj}`);

    const searchResponse = await fetch(`${API_URL}/accounts?cpfCnpj=${cpfCnpj}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'access_token': config.api_key
        }
    });

    if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
            console.log(`[asaas-create-or-connect-organizer] Found existing Asaas account: ${searchData.data[0].id}`);
            asaasAccountId = searchData.data[0].id;
            asaasWalletId = searchData.data[0].walletId;
        }
    } else {
        console.warn('[asaas-create-or-connect-organizer] Error searching for existing account, proceeding to create.');
    }

    // 5. Create Subaccount in Asaas (if not found)
    if (!asaasAccountId) {
        console.log(`[asaas-create-or-connect-organizer] Creating new Asaas account...`);
        const accountPayload = {
            name,
            email,
            cpfCnpj,
            mobilePhone,
            address,
            addressNumber,
            complement,
            province,
            postalCode
        }

        const createResponse = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': config.api_key
            },
            body: JSON.stringify(accountPayload)
        })

        const createData = await createResponse.json()

        if (!createResponse.ok) {
            console.error('Asaas API Error:', createData);
            
            // Handle specific "Account already exists" error from Asaas if search failed
            // Asaas usually returns 400 with specific error code if uniqueness is violated in a way that blocks creation
            
            return new Response(JSON.stringify({ error: 'Error creating account at Asaas', details: createData }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        asaasAccountId = createData.id;
        asaasWalletId = createData.walletId;
        isNewAccount = true;
    }

    // 6. Save to DB
    console.log(`[asaas-create-or-connect-organizer] Saving to DB: ${asaasAccountId}`);

    const { data: newAccount, error: dbError } = await adminClient
        .from('organizer_asaas_accounts')
        .insert({
            organizer_user_id: user.id,
            asaas_account_id: asaasAccountId,
            // wallet_id: asaasWalletId, // Ensure your table has this column if you want to store it
            kyc_status: 'pending', // Assume pending/under analysis initially
            is_active: false
        })
        .select()
        .single()

    if (dbError) {
        console.error('[asaas-create-or-connect-organizer] DB Error:', dbError);
        return new Response(JSON.stringify({ error: 'Error saving account to database', details: dbError }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // 7. Trigger KYC Refresh (Async) to update status immediately if possible
    // We can call the refresh function or just let the user do it
    // For now, return the account
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: isNewAccount ? 'Account created successfully' : 'Existing Asaas account connected',
        account: newAccount
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[asaas-create-or-connect-organizer] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
