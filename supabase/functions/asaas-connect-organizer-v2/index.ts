
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[asaas-connect-organizer-v2] Auth Error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🚨 A PARTIR DAQUI O ORGANIZADOR ESTÁ AUTENTICADO
    console.log(`[asaas-connect-organizer-v2] User Authenticated: ${user.id}`);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { name, email, cpfCnpj, mobilePhone, address, addressNumber, complement, province, postalCode } = body;

    // Validar payload mínimo
    if (!name || !email || !cpfCnpj || !mobilePhone || !address || !postalCode) {
      return new Response(
        JSON.stringify({ error: "Missing required organizer data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Buscar integração ASAAS ativa (via Admin Client para segurança)
    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config');

    if (configError || !config || !config.api_key) {
      console.error("[asaas-connect-organizer-v2] Asaas config error:", configError);
      return new Response(
        JSON.stringify({ error: "Asaas configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_URL = config.environment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3';

    // 2) Verificar se conta já existe no BD
    const { data: existingAccount } = await adminClient
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', user.id)
        .single();

    if (existingAccount) {
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Account already connected',
            account: existingAccount
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3) Verificar se conta já existe no ASAAS (CPF/CNPJ)
    let asaasAccountId = null;
    let isNewAccount = false;

    console.log(`[asaas-connect-organizer-v2] Searching for existing Asaas account for CPF/CNPJ: ${cpfCnpj}`);

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
            console.log(`[asaas-connect-organizer-v2] Found existing Asaas account: ${searchData.data[0].id}`);
            asaasAccountId = searchData.data[0].id;
        }
    } else {
        console.warn('[asaas-connect-organizer-v2] Error searching for existing account, proceeding to create.');
    }

    // 4) Criar subconta ASAAS (se não encontrada)
    if (!asaasAccountId) {
        console.log(`[asaas-connect-organizer-v2] Creating new Asaas account...`);
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
        };

        const createResponse = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': config.api_key
            },
            body: JSON.stringify(accountPayload)
        });

        const createData = await createResponse.json();

        if (!createResponse.ok) {
            console.error('Asaas API Error:', createData);
            return new Response(JSON.stringify({ error: 'Error creating account at Asaas', details: createData }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        asaasAccountId = createData.id;
        isNewAccount = true;
    }

    // 5) Salvar asaas_account_id vinculado ao user.id
    console.log(`[asaas-connect-organizer-v2] Saving to DB: ${asaasAccountId}`);

    const { data: newAccount, error: dbError } = await adminClient
        .from('organizer_asaas_accounts')
        .insert({
            organizer_user_id: user.id,
            asaas_account_id: asaasAccountId,
            kyc_status: 'pending',
            is_active: false
        })
        .select()
        .single();

    if (dbError) {
        console.error('[asaas-connect-organizer-v2] DB Error:', dbError);
        return new Response(JSON.stringify({ error: 'Error saving account to database', details: dbError }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          message: isNewAccount ? 'Account created successfully' : 'Existing Asaas account connected',
          account: newAccount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[asaas-connect-organizer-v2] Internal Error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal error while creating ASAAS account",
        detail: String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
