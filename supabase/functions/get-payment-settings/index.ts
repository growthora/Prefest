import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)
  // console.log(`[ENTRY-PROBE] Method: ${req.method}`)

  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    // Service Role for accessing protected integrations table
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: config, error } = await adminClient
      .from('integrations')
      .select('platform_fee_type, platform_fee_value')
      .eq('provider', 'asaas')
      .single()

    if (error) {
      // console.error('Error fetching payment settings:', error)
      // Fallback defaults if config missing
      return new Response(JSON.stringify({ 
        platform_fee_type: 'percentage', 
        platform_fee_value: 10 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        status: 200
      })
    }

    return new Response(JSON.stringify({
      ...config,
      platform_fee_type: 'percentage',
      platform_fee_value: 10,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
      status: 200
    })

  } catch (error: any) {
    // console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, // Retornar 500 para erro interno, mas com JSON válido
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    })
  }
})
