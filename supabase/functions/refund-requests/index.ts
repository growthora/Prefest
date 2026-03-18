import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { requireRole } from "../_shared/requireRole.ts";

const REFUNDABLE_PAYMENT_STATUSES = new Set(["paid", "received", "confirmed"]);
const BLOCKED_TICKET_STATUSES = new Set(["refunded", "cancelled", "canceled", "used"]);

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function buildUserPayload(adminClient: any, userId: string) {
  const { data: requests, error: requestsError } = await adminClient
    .from("refund_requests")
    .select("id, user_id, ticket_id, payment_id, reason, status, provider_refund_id, notes, reviewed_by, reviewed_at, requested_at, created_at, updated_at")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

  if (requestsError) throw requestsError;

  const { data: tickets, error: ticketsError } = await adminClient
    .from("tickets")
    .select("id, event_id, ticket_type_id, quantity, total_price, status, created_at")
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false });

  if (ticketsError) throw ticketsError;

  const ticketIds = (tickets || []).map((ticket: any) => ticket.id);
  const eventIds = Array.from(new Set((tickets || []).map((ticket: any) => ticket.event_id).filter(Boolean)));
  const ticketTypeIds = Array.from(new Set((tickets || []).map((ticket: any) => ticket.ticket_type_id).filter(Boolean)));

  const [{ data: payments, error: paymentsError }, { data: events, error: eventsError }, { data: ticketTypes, error: ticketTypesError }] = await Promise.all([
    ticketIds.length > 0
      ? adminClient.from("payments").select("id, ticket_id, status, value, payment_method, external_payment_id, created_at").in("ticket_id", ticketIds as any)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length > 0
      ? adminClient.from("events").select("id, title, slug, event_date, end_at, status").in("id", eventIds as any)
      : Promise.resolve({ data: [], error: null }),
    ticketTypeIds.length > 0
      ? adminClient.from("ticket_types").select("id, name").in("id", ticketTypeIds as any)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (paymentsError) throw paymentsError;
  if (eventsError) throw eventsError;
  if (ticketTypesError) throw ticketTypesError;

  const paymentByTicketId = new Map((payments || []).map((payment: any) => [payment.ticket_id, payment]));
  const eventById = new Map((events || []).map((event: any) => [event.id, event]));
  const ticketTypeById = new Map((ticketTypes || []).map((ticketType: any) => [ticketType.id, ticketType]));
  const requestByTicketId = new Map((requests || []).map((request: any) => [request.ticket_id, request]));

  const eligibleTickets = (tickets || [])
    .map((ticket: any) => {
      const payment = paymentByTicketId.get(ticket.id);
      const refundRequest = requestByTicketId.get(ticket.id) || null;
      const event = eventById.get(ticket.event_id) || null;
      const ticketType = ticketTypeById.get(ticket.ticket_type_id) || null;
      const paymentStatus = String(payment?.status || "").toLowerCase();
      const ticketStatus = String(ticket?.status || "").toLowerCase();
      const canRequestRefund = !!payment && REFUNDABLE_PAYMENT_STATUSES.has(paymentStatus) && !BLOCKED_TICKET_STATUSES.has(ticketStatus) && !refundRequest;

      return {
        id: ticket.id,
        quantity: ticket.quantity,
        total_price: ticket.total_price,
        status: ticket.status,
        created_at: ticket.created_at,
        event,
        ticket_type: ticketType,
        payment,
        refund_request: refundRequest,
        can_request_refund: canRequestRefund,
      };
    })
    .filter((ticket: any) => ticket.payment || ticket.refund_request);

  return {
    requests: requests || [],
    eligibleTickets,
  };
}

async function buildAdminPayload(adminClient: any) {
  const { data: requests, error: requestsError } = await adminClient
    .from("refund_requests")
    .select("id, user_id, ticket_id, payment_id, reason, status, provider_refund_id, notes, reviewed_by, reviewed_at, requested_at, created_at, updated_at")
    .order("requested_at", { ascending: false });

  if (requestsError) throw requestsError;

  const userIds = Array.from(new Set((requests || []).flatMap((request: any) => [request.user_id, request.reviewed_by]).filter(Boolean)));
  const ticketIds = Array.from(new Set((requests || []).map((request: any) => request.ticket_id).filter(Boolean)));
  const paymentIds = Array.from(new Set((requests || []).map((request: any) => request.payment_id).filter(Boolean)));

  const [{ data: profiles, error: profilesError }, { data: tickets, error: ticketsError }, { data: payments, error: paymentsError }] = await Promise.all([
    userIds.length > 0
      ? adminClient.from("profiles").select("id, full_name, email").in("id", userIds as any)
      : Promise.resolve({ data: [], error: null }),
    ticketIds.length > 0
      ? adminClient.from("tickets").select("id, event_id, ticket_type_id, quantity, total_price, status").in("id", ticketIds as any)
      : Promise.resolve({ data: [], error: null }),
    paymentIds.length > 0
      ? adminClient.from("payments").select("id, status, value, payment_method, external_payment_id").in("id", paymentIds as any)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesError) throw profilesError;
  if (ticketsError) throw ticketsError;
  if (paymentsError) throw paymentsError;

  const eventIds = Array.from(new Set((tickets || []).map((ticket: any) => ticket.event_id).filter(Boolean)));
  const ticketTypeIds = Array.from(new Set((tickets || []).map((ticket: any) => ticket.ticket_type_id).filter(Boolean)));

  const [{ data: events, error: eventsError }, { data: ticketTypes, error: ticketTypesError }] = await Promise.all([
    eventIds.length > 0
      ? adminClient.from("events").select("id, title, slug, event_date, end_at, status").in("id", eventIds as any)
      : Promise.resolve({ data: [], error: null }),
    ticketTypeIds.length > 0
      ? adminClient.from("ticket_types").select("id, name").in("id", ticketTypeIds as any)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eventsError) throw eventsError;
  if (ticketTypesError) throw ticketTypesError;

  const profileById = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
  const ticketById = new Map((tickets || []).map((ticket: any) => [ticket.id, ticket]));
  const paymentById = new Map((payments || []).map((payment: any) => [payment.id, payment]));
  const eventById = new Map((events || []).map((event: any) => [event.id, event]));
  const ticketTypeById = new Map((ticketTypes || []).map((ticketType: any) => [ticketType.id, ticketType]));

  return (requests || []).map((request: any) => {
    const ticket = ticketById.get(request.ticket_id) || null;
    return {
      ...request,
      user: profileById.get(request.user_id) || null,
      reviewed_by_profile: request.reviewed_by ? profileById.get(request.reviewed_by) || null : null,
      payment: request.payment_id ? paymentById.get(request.payment_id) || null : null,
      ticket: ticket
        ? {
            ...ticket,
            event: eventById.get(ticket.event_id) || null,
            ticket_type: ticketTypeById.get(ticket.ticket_type_id) || null,
          }
        : null,
    };
  });
}

async function invalidateParticipantAccess(adminClient: any, ticketId: string) {
  await adminClient
    .from("event_participants")
    .update({ status: "cancelled", total_paid: 0 })
    .eq("ticket_id", ticketId);
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { user, supabase: userClient } = await requireAuth(req);
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const scope = url.searchParams.get("scope");

      if (scope === "admin") {
        await requireRole(userClient, user.id, ["ADMIN"]);
        const requests = await buildAdminPayload(adminClient);
        return jsonResponse(req, { requests });
      }

      const payload = await buildUserPayload(adminClient, user.id);
      return jsonResponse(req, payload);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const ticketId = String(body.ticketId || "").trim();
      const reason = String(body.reason || "").trim();

      if (!ticketId) {
        return jsonResponse(req, { error: "ticketId é obrigatório" }, 400);
      }

      const { data: ticket, error: ticketError } = await adminClient
        .from("tickets")
        .select("id, buyer_user_id, status")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketError) throw ticketError;
      if (!ticket || ticket.buyer_user_id !== user.id) {
        return jsonResponse(req, { error: "Ingresso não encontrado" }, 404);
      }

      const ticketStatus = String(ticket.status || "").toLowerCase();
      if (BLOCKED_TICKET_STATUSES.has(ticketStatus)) {
        return jsonResponse(req, { error: "Este ingresso não pode ser reembolsado" }, 400);
      }

      const { data: payment, error: paymentError } = await adminClient
        .from("payments")
        .select("id, status, external_payment_id, provider")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) throw paymentError;
      const paymentStatus = String(payment?.status || "").toLowerCase();
      if (!payment || !REFUNDABLE_PAYMENT_STATUSES.has(paymentStatus)) {
        return jsonResponse(req, { error: "Pagamento não elegível para reembolso" }, 400);
      }

      const { data: existingRequest, error: existingRequestError } = await adminClient
        .from("refund_requests")
        .select("id, status")
        .eq("ticket_id", ticketId)
        .maybeSingle();

      if (existingRequestError) throw existingRequestError;
      if (existingRequest) {
        return jsonResponse(req, { error: "Já existe uma solicitação para este ingresso" }, 400);
      }

      const { data: refundRequest, error: insertError } = await adminClient
        .from("refund_requests")
        .insert({
          user_id: user.id,
          ticket_id: ticketId,
          payment_id: payment.id,
          reason: reason || null,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      return jsonResponse(req, { ok: true, request: refundRequest }, 201);
    }

    if (req.method === "PATCH") {
      await requireRole(userClient, user.id, ["ADMIN"]);
      const body = await req.json();
      const requestId = String(body.requestId || "").trim();
      const action = String(body.action || "").trim().toLowerCase();
      const notes = String(body.notes || "").trim();

      if (!requestId || !action) {
        return jsonResponse(req, { error: "requestId e action são obrigatórios" }, 400);
      }

      const { data: refundRequest, error: requestError } = await adminClient
        .from("refund_requests")
        .select("id, ticket_id, payment_id, status")
        .eq("id", requestId)
        .maybeSingle();

      if (requestError) throw requestError;
      if (!refundRequest) {
        return jsonResponse(req, { error: "Solicitação não encontrada" }, 404);
      }

      if (action === "approve") {
        const { error } = await adminClient
          .from("refund_requests")
          .update({
            status: "approved",
            notes: notes || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (error) throw error;
        return jsonResponse(req, { ok: true });
      }

      if (action === "reject") {
        const { error } = await adminClient
          .from("refund_requests")
          .update({
            status: "rejected",
            notes: notes || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", requestId);
        if (error) throw error;
        return jsonResponse(req, { ok: true });
      }

      if (action === "process") {
        const { data: payment, error: paymentError } = await adminClient
          .from("payments")
          .select("id, status, external_payment_id, provider, ticket_id")
          .eq("id", refundRequest.payment_id)
          .maybeSingle();

        if (paymentError) throw paymentError;
        if (!payment) {
          return jsonResponse(req, { error: "Pagamento vinculado não encontrado" }, 404);
        }

        const paymentStatus = String(payment.status || "").toLowerCase();
        if (paymentStatus === "refunded") {
          await adminClient
            .from("refund_requests")
            .update({
              status: "refunded",
              notes: notes || null,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              provider_refund_id: payment.external_payment_id,
            })
            .eq("id", requestId);
          await invalidateParticipantAccess(adminClient, refundRequest.ticket_id);
          return jsonResponse(req, { ok: true, status: "refunded" });
        }

        if (!REFUNDABLE_PAYMENT_STATUSES.has(paymentStatus) || !payment.external_payment_id || String(payment.provider || "").toLowerCase() !== "asaas") {
          return jsonResponse(req, { error: "Pagamento não pode ser processado para reembolso automático" }, 400);
        }

        const { data: config, error: configError } = await adminClient.rpc("get_decrypted_asaas_config").single();
        if (configError || !config) {
          throw new Error("Falha ao carregar configuração Asaas");
        }

        const apiKey = String(config.api_key || config.secret_key || "").trim();
        const runtimeEnv = String(config.env || config.environment || "sandbox").toLowerCase();
        const baseUrl = runtimeEnv === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";

        const refundRes = await fetch(`${baseUrl}/payments/${payment.external_payment_id}/refund`, {
          method: "POST",
          headers: {
            access_token: apiKey,
            "Content-Type": "application/json; charset=utf-8",
          },
        });

        if (!refundRes.ok) {
          const errorText = await refundRes.text();
          await adminClient
            .from("refund_requests")
            .update({
              status: "failed",
              notes: notes || errorText,
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", requestId);
          return jsonResponse(req, { error: `Falha ao solicitar reembolso no Asaas: ${errorText}` }, 400);
        }

        const refundData = await refundRes.json();
        const { error: updateError } = await adminClient
          .from("refund_requests")
          .update({
            status: "processing",
            notes: notes || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            provider_refund_id: refundData?.id || payment.external_payment_id,
          })
          .eq("id", requestId);

        if (updateError) throw updateError;
        return jsonResponse(req, { ok: true, status: "processing" });
      }

      return jsonResponse(req, { error: "Ação inválida" }, 400);
    }

    return jsonResponse(req, { error: "Método não suportado" }, 405);
  } catch (error: any) {
    return jsonResponse(req, { error: error?.message || "Erro interno" }, 500);
  }
});
