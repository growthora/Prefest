import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { requireRole } from "../_shared/requireRole.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: userClient } = await requireAuth(req);
    await requireRole(userClient, user.id, ["ADMIN"]);

    let body: { userId?: string; newPassword?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const userId = String(body.userId || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ ok: false, error: "A senha deve ter no mínimo 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
    );
  }
});
