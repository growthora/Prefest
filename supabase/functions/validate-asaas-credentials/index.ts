import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { requireRole } from '../_shared/requireRole.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Authenticate User
    const { user, supabase: supabaseClient } = await requireAuth(req);
    
    // 2. Authorize Admin (Only admins can validate credentials)
    await requireRole(supabaseClient, user.id, ['ADMIN']);

    // 3. Parse Body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Invalid JSON body' 
        }), {
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const { apiKey, environment } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'API Key is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Validate with Asaas
    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3' 
      : 'https://sandbox.asaas.com/api/v3';

    console.log(`Validating Asaas credentials for env: ${environment}`);

    // Fetch customers endpoint (limit 1) to validate key
    const response = await fetch(`${baseUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': apiKey.trim(),
        'Content-Type': 'application/json',
        'User-Agent': 'PrefRest-Validator/1.0'
      }
    });

    if (!response.ok) {
        let errorMessage = `Invalid credentials or environment: ${response.statusText}`;
        try {
           const errorData = await response.json();
           if (errorData.errors && errorData.errors.length > 0) {
              errorMessage = errorData.errors[0].description || errorMessage;
           }
        } catch (e) {
           // ignore json parse error
        }
        
        console.warn('Asaas Validation Failed:', errorMessage);
        
        return new Response(JSON.stringify({ 
            valid: false, 
            error: errorMessage 
        }), {
            status: 200, // Return 200 with valid: false to handle gracefully in frontend
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    const data = await response.json();

    return new Response(JSON.stringify({ 
        valid: true, 
        data: {
            environment,
            timestamp: new Date().toISOString()
        }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Handle explicitly thrown Responses
    if (error instanceof Response) return error;

    console.error('Function Error validate-asaas-credentials:', error);
    return new Response(JSON.stringify({ 
        valid: false,
        error: `Internal Error: ${error.message || 'Unknown error'}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
