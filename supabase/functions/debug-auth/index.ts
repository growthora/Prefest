import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get('Authorization')
    const cookieHeader = req.headers.get('Cookie')
    
    // Check if authorization header is present
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          hasSession: false, 
          error: 'No Authorization header found',
          headers: {
            auth: authHeader ? 'Present' : 'Missing',
            cookie: cookieHeader ? 'Present' : 'Missing'
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 // Return 200 to show the result clearly instead of 401
        }
      )
    }

    // Create client with the auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify User
    const { data: { user }, error } = await supabaseClient.auth.getUser()

    return new Response(
      JSON.stringify({
        hasSession: !!user,
        session: user ? 'OK' : null,
        user_id: user?.id,
        email: user?.email,
        auth_header_length: authHeader.length,
        error: error ? error.message : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
