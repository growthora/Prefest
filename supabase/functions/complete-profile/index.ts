import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"
import { requireAuth } from "../_shared/requireAuth.ts"

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÃ“STICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    // Verify user is authenticated
    const { user, supabase: supabaseClient } = await requireAuth(req)

    // Parse body
    const { cpf, phone, birth_date } = await req.json()

    // Basic validation
    if (!cpf || !phone || !birth_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      })
    }

    // Update profile
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({
        cpf,
        phone,
        birth_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      // console.error('Error updating profile:', error)
      return new Response(JSON.stringify({ error: 'Failed to update profile', details: error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      })
    }

    return new Response(JSON.stringify(data), {
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
