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
    const { apiKey, environment } = await req.json();

    if (!apiKey) {
      throw new Error('API Key is required');
    }

    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/api/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    // Validate by fetching customers endpoint (limit 1)
    const response = await fetch(`${baseUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
