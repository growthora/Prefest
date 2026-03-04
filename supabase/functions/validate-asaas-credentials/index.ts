import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { requireRole } from '../_shared/requireRole.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: supabaseClient } = await requireAuth(req);
    
    // Admin check
    await requireRole(supabaseClient, user.id, ['ADMIN']);

    const { apiKey, environment, useStored } = await req.json();
    let keyToValidate = (apiKey || '').trim();

    if (!keyToValidate && useStored) {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: config, error: configError } = await adminClient
        .rpc('get_decrypted_asaas_config')
        .single();

      if (configError || !config?.api_key) {
        throw new Error('Stored Asaas API Key not found');
      }

      keyToValidate = config.api_key;
    }

    if (!keyToValidate) {
      throw new Error('API Key is required');
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Validate by fetching customers endpoint (limit 1)
    const response = await fetch(`${baseUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': keyToValidate,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    if (!response.ok) {
        // Try to get error message from body
        let errorMessage = `Invalid credentials or environment: ${response.statusText}`;
        try {
           const errorData = await response.json();
           if (errorData.errors && errorData.errors.length > 0) {
              errorMessage = errorData.errors[0].description || errorMessage;
           }
        } catch (e) {
           // ignore json parse error
        }
        throw new Error(errorMessage);
    }
    
    const data = await response.json();

    return new Response(JSON.stringify({ valid: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});
