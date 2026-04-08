import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getMissingProfileFields, syncCheckoutProfileSnapshot } from "../_shared/profileSync.ts"

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Verify user is authenticated
    const { user } = await requireAuth(req)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Parse body
    const { cpf, phone, birth_date } = await req.json()

    // Basic validation
    if (!cpf || !phone || !birth_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      })
    }

    const snapshot = await syncCheckoutProfileSnapshot(adminClient, user.id, {
        cpf,
        phone,
        birth_date,
        email: user.email ?? undefined,
      })

    return new Response(JSON.stringify({
      ...snapshot,
      missing_fields: getMissingProfileFields(snapshot),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    })

  } catch (error: any) {
    // console.error('Unexpected error:', error)
    
    // Check if error is a Response object (from requireAuth)
    if (error instanceof Response) {
      return error
    }

    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    })
  }
})
