import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";

const SOLD_PAYMENT_STATUSES = new Set([
  "PAID",
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: userClient } = await requireAuth(req);

    let body: { eventId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const eventId = String(body.eventId || "").trim();
    if (!eventId) {
      return new Response(JSON.stringify({ error: "eventId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: event, error: eventError } = await serviceClient
      .from("events")
      .select("id, creator_id")
      .eq("id", eventId)
      .single();
    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Evento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const { data: requesterProfile } = await userClient
      .from("profiles")
      .select("roles, role")
      .eq("id", user.id)
      .single();
    const roles = (requesterProfile?.roles || []).map((r: string) => String(r).toUpperCase());
    const isAdmin = roles.includes("ADMIN") || String(requesterProfile?.role || "").toLowerCase() === "admin";
    const isOwner = event.creator_id === user.id;
    if (!isAdmin && !isOwner) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const { data: tickets, error: ticketsError } = await serviceClient
      .from("tickets")
      .select("id")
      .eq("event_id", eventId);
    if (ticketsError) throw ticketsError;

    const ticketIds = (tickets || []).map((t: any) => t.id);
    if (ticketIds.length > 0) {
      const { data: payments, error: paymentsError } = await serviceClient
        .from("payments")
        .select("id, status")
        .in("ticket_id", ticketIds as any);
      if (paymentsError) throw paymentsError;

      const hasSoldTickets = (payments || []).some((p: any) =>
        SOLD_PAYMENT_STATUSES.has(String(p.status || "").toUpperCase())
      );
      if (hasSoldTickets) {
        return new Response(
          JSON.stringify({
            error:
              "Não é possível excluir este evento porque já houve ingressos vendidos. Use desativar para deixar o evento totalmente offline.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }

      const paymentIds = (payments || []).map((p: any) => p.id);
      if (paymentIds.length > 0) {
        const { error: splitDeleteError } = await serviceClient
          .from("payment_splits")
          .delete()
          .in("payment_id", paymentIds as any);
        if (splitDeleteError) throw splitDeleteError;

        const { error: paymentsDeleteError } = await serviceClient
          .from("payments")
          .delete()
          .in("id", paymentIds as any);
        if (paymentsDeleteError) throw paymentsDeleteError;
      }

      const { error: ticketsDeleteError } = await serviceClient
        .from("tickets")
        .delete()
        .eq("event_id", eventId);
      if (ticketsDeleteError) throw ticketsDeleteError;
    }

    // Cleanup side tables that may reference event without cascade.
    await serviceClient.from("event_participants").delete().eq("event_id", eventId);
    await serviceClient.from("check_in_logs").delete().eq("event_id", eventId);
    await serviceClient.from("event_likes").delete().eq("event_id", eventId);

    const { error: deleteEventError } = await serviceClient
      .from("events")
      .delete()
      .eq("id", eventId);
    if (deleteEventError) throw deleteEventError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});
