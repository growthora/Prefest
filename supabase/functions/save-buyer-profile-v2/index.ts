
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from "../_shared/requireAuth.ts";
import { getMissingProfileFields, syncCheckoutProfileSnapshot } from "../_shared/profileSync.ts";

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

    const { full_name, cpf, phone, email, birth_date } = await req.json();

    if (!full_name || !cpf || !phone || !(user.email || email)) {
      throw new Error('Missing required fields');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const snapshot = await syncCheckoutProfileSnapshot(adminClient, user.id, {
      full_name,
      cpf,
      phone,
      email: user.email ?? email,
      birth_date,
    });

    return new Response(JSON.stringify({
      success: true,
      profile: snapshot,
      missing_fields: getMissingProfileFields(snapshot),
    }), {
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
