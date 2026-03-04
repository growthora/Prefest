
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from "../_shared/requireAuth.ts";

Deno.serve(async (req) => {
  // FASE 1: PROVA DEFINITIVA - DIAGNÓSTICO (Logo na entrada)
  const authProbe = req.headers.get("Authorization") ?? ""
  // console.log("[ENTRY-PROBE] Auth present:", Boolean(authProbe))
  // console.log("[ENTRY-PROBE] Auth prefix:", authProbe.slice(0, 18)) 
  // console.log("[ENTRY-PROBE] Auth len:", authProbe.length)

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Verify User Authentication
    const { user } = await requireAuth(req);

    const { full_name, cpf, phone, email } = await req.json();

    if (!full_name || !cpf || !phone || !email) {
      throw new Error('Missing required fields');
    }

    // Use admin client for upsert
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: upsertError } = await adminClient
      .from('buyer_profiles')
      .upsert({
        user_id: user.id,
        full_name,
        cpf,
        phone,
        email,
        updated_at: new Date().toISOString()
      });

    if (upsertError) {
      // console.error('Upsert error:', upsertError);
      throw new Error('Failed to save profile');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });

  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
});

