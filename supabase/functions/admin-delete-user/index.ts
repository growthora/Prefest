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

    let body: { userId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const userId = String(body.userId || "").trim();
    if (!userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id, roles")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ ok: false, error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const { data: ticketRows, error: ticketRowsError } = await adminClient
      .from("tickets")
      .select("id")
      .eq("buyer_user_id", userId);

    if (ticketRowsError) throw ticketRowsError;

    const ticketIds = (ticketRows || []).map((ticket: any) => ticket.id);

    if (ticketIds.length > 0) {
      const { error: paymentsByTicketError } = await adminClient
        .from("payments")
        .delete()
        .in("ticket_id", ticketIds as any);
      if (paymentsByTicketError) throw paymentsByTicketError;

      const { error: ticketsError } = await adminClient
        .from("tickets")
        .delete()
        .in("id", ticketIds as any);
      if (ticketsError) throw ticketsError;
    }

    const { error: eventParticipantsError } = await adminClient
      .from("event_participants")
      .delete()
      .eq("user_id", userId);
    if (eventParticipantsError) throw eventParticipantsError;

    const { data: matchRows, error: matchRowsError } = await adminClient
      .from("matches")
      .select("id")
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);
    if (matchRowsError) throw matchRowsError;

    const matchIds = (matchRows || []).map((match: any) => match.id);

    if (matchIds.length > 0) {
      const { error: matchesError } = await adminClient
        .from("matches")
        .delete()
        .in("id", matchIds as any);
      if (matchesError) throw matchesError;
    }

    await adminClient.from("roles_audit_logs").delete().eq("target_user_id", userId);
    await adminClient.from("roles_audit_logs").delete().eq("performed_by", userId);
    await adminClient.from("team_members").delete().eq("user_id", userId);
    await adminClient.from("team_members").delete().eq("organizer_id", userId);

    const { error: profileDeleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileDeleteError) throw profileDeleteError;

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
    );
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }

    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } }
    );
  }
});
