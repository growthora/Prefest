import { withMiddleware } from "../_shared/middleware.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  assertCondition,
  errorResponse,
  getQueryParam,
  getRouteSegments,
  HttpError,
  parseJsonBody,
} from "../_shared/http.ts";
import { callLegacyFunction } from "../_shared/legacyProxy.ts";

function normalizeEventStatus(status: unknown) {
  return String(status || "").toLowerCase();
}

function isCanceledStatus(status: unknown) {
  const normalized = normalizeEventStatus(status);
  return normalized === "cancelado" || normalized === "canceled" || normalized === "cancelled";
}

function sanitizeTicketTypePayload(payload: any) {
  return {
    name: String(payload?.name || "").trim(),
    description: payload?.description ?? null,
    price: Number(payload?.price) || 0,
    quantity_available: Number(payload?.quantity_available) || 0,
    sale_start_date: payload?.sale_start_date ?? null,
    sale_end_date: payload?.sale_end_date ?? null,
    is_active: payload?.is_active ?? true,
  };
}

function mapParticipationRow(row: any) {
  if (!row) return null;
  return {
    ...row,
    security_token: row.ticket_token ?? null,
    match_enabled: row.profile?.match_enabled ?? false,
    profile: undefined,
  };
}

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "ticket-api");

    if (req.method === "GET" && segments[0] === "event" && segments[2] === "types" && segments.length === 3) {
      return withMiddleware(req, { action: "ticket_types_list_public", requireAuth: false }, async ({ serviceClient }) => {
        const eventId = String(segments[1] || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "Event ID invalido", 400);

        const nowIso = new Date().toISOString();
        const { data: eventRow, error: eventError } = await serviceClient
          .from("events")
          .select("end_at, event_date, sales_enabled, status, is_active")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError) throw new HttpError("EVENT_FETCH_FAILED", eventError.message, 400);
        if (!eventRow || (eventRow as any)?.status !== "published") return { ticket_types: [] };

        const eventEndAt = new Date(((eventRow as any)?.end_at || (eventRow as any)?.event_date || nowIso) as string).getTime();
        if ((eventRow as any)?.is_active === false || isCanceledStatus((eventRow as any)?.status) || (eventRow as any)?.sales_enabled === false) {
          return { ticket_types: [] };
        }
        if (!Number.isNaN(eventEndAt) && Date.now() >= eventEndAt) return { ticket_types: [] };

        const { data, error } = await serviceClient
          .from("ticket_types")
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date, created_at, updated_at")
          .eq("event_id", eventId)
          .eq("is_active", true)
          .or(`sale_start_date.is.null,sale_start_date.lte.${nowIso}`)
          .or(`sale_end_date.is.null,sale_end_date.gte.${nowIso}`)
          .order("price", { ascending: true });

        if (error) throw new HttpError("TICKET_TYPES_FETCH_FAILED", error.message, 400);
        return {
          ticket_types: (data || [])
            .filter((ticket: any) => !ticket.is_test && !ticket.is_internal && !ticket.is_hidden)
            .filter((ticket: any) => Number(ticket.quantity_sold || 0) < Number(ticket.quantity_available || 0)),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "event" && segments[2] === "types" && segments[3] === "organizer") {
      return withMiddleware(req, { action: "ticket_types_list_for_organizer" }, async ({ supabase }) => {
        const eventId = String(segments[1] || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);

        const { data, error } = await supabase!
          .from("ticket_types")
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true });

        if (error) throw new HttpError("TICKET_TYPES_FETCH_FAILED", error.message, 400);
        return { ticket_types: data || [] };
      });
    }

    if (req.method === "POST" && segments[0] === "event" && segments[2] === "types" && segments[3] === "bulk") {
      return withMiddleware(req, { action: "ticket_types_create_many" }, async ({ supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const body = await parseJsonBody<{ ticketTypes?: any[] }>(req);
        const ticketTypes = Array.isArray(body.ticketTypes) ? body.ticketTypes : [];
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);
        assertCondition(ticketTypes.length > 0, "INVALID_TICKET_TYPES", "ticketTypes invalidos", 400);

        const payload = ticketTypes.map((ticket) => ({ event_id: eventId, ...sanitizeTicketTypePayload(ticket) }));
        if (payload.some((ticket) => !ticket.name)) throw new HttpError("INVALID_TICKET_NAME", "Nome do lote invalido", 400);

        const { data, error } = await supabase!
          .from("ticket_types")
          .insert(payload as never)
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at");

        if (error) throw new HttpError("TICKET_TYPES_CREATE_FAILED", error.message, 400);
        return { ticket_types: data || [] };
      });
    }

    if (req.method === "POST" && segments[0] === "event" && segments[2] === "types" && segments.length === 3) {
      return withMiddleware(req, { action: "ticket_type_create" }, async ({ supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const body = await parseJsonBody<{ payload?: any }>(req);
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);

        const dataToInsert = { event_id: eventId, ...sanitizeTicketTypePayload(body.payload) };
        if (!dataToInsert.name) throw new HttpError("INVALID_NAME", "Nome invalido", 400);

        const { data, error } = await supabase!
          .from("ticket_types")
          .insert(dataToInsert as never)
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
          .single();

        if (error) throw new HttpError("TICKET_TYPE_CREATE_FAILED", error.message, 400);
        return { ticket_type: data };
      });
    }

    if (req.method === "GET" && segments[0] === "types" && segments[1]) {
      return withMiddleware(req, { action: "ticket_type_get" }, async ({ supabase }) => {
        const ticketTypeId = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("ticket_types")
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
          .eq("id", ticketTypeId)
          .single();

        if (error) throw new HttpError("TICKET_TYPE_FETCH_FAILED", error.message, 400);
        return { ticket_type: data };
      });
    }

    if (req.method === "PUT" && segments[0] === "types" && segments[1]) {
      return withMiddleware(req, { action: "ticket_type_update" }, async ({ supabase }) => {
        const ticketTypeId = String(segments[1] || "").trim();
        const body = await parseJsonBody<{ payload?: Record<string, unknown> }>(req);
        const payload = body.payload ?? {};
        const allowedKeys = new Set(["name", "description", "price", "quantity_available", "sale_start_date", "sale_end_date", "is_active"]);
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
          if (allowedKeys.has(key)) out[key] = value;
        }
        out.updated_at = new Date().toISOString();

        const { data, error } = await supabase!
          .from("ticket_types")
          .update(out as never)
          .eq("id", ticketTypeId)
          .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
          .single();

        if (error) throw new HttpError("TICKET_TYPE_UPDATE_FAILED", error.message, 400);
        return { ticket_type: data };
      });
    }

    if (req.method === "DELETE" && segments[0] === "types" && segments[1]) {
      return withMiddleware(req, { action: "ticket_type_delete" }, async ({ supabase }) => {
        const ticketTypeId = String(segments[1] || "").trim();
        const { data: existing, error: existingError } = await supabase!
          .from("ticket_types")
          .select("id, quantity_sold")
          .eq("id", ticketTypeId)
          .single();

        if (existingError) throw new HttpError("TICKET_TYPE_FETCH_FAILED", existingError.message, 400);
        if (Number((existing as any)?.quantity_sold || 0) > 0) {
          throw new HttpError("TICKET_TYPE_HAS_SALES", "Nao e possivel excluir lote com ingressos vendidos.", 400);
        }

        const { error } = await supabase!.from("ticket_types").delete().eq("id", ticketTypeId);
        if (error) throw new HttpError("TICKET_TYPE_DELETE_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "participants" && segments[1]) {
      return withMiddleware(req, { action: "ticket_participation_get" }, async ({ user, supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const userId = String(getQueryParam(req, "userId") || "").trim() || user!.id;
        const { data, error } = await supabase!
          .from("event_participants")
          .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, status, check_in_at, ticket_token, ticket_code, qr_code_data, profile:profiles!event_participants_user_id_fkey(match_enabled)")
          .eq("event_id", eventId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw new HttpError("PARTICIPATION_FETCH_FAILED", error.message, 400);
        return { participation: mapParticipationRow(data) };
      });
    }

    if (req.method === "POST" && segments[0] === "participants" && segments[1] === "join") {
      return withMiddleware(
        req,
        { action: "ticket_participation_join", rateLimit: { endpoint: "ticket-join", maxRequests: 30, windowSeconds: 60 } },
        async ({ user, supabase }) => {
          const body = await parseJsonBody<{ eventId?: string; ticketQuantity?: number; ticketTypeId?: string | null; totalPaid?: number | null }>(req);
          const eventId = String(body.eventId || "").trim();
          const ticketQuantity = Number(body.ticketQuantity || 1);
          const ticketTypeId = body.ticketTypeId ? String(body.ticketTypeId).trim() : null;
          const totalPaid = body.totalPaid != null ? Number(body.totalPaid) : null;

          if (!eventId) throw new HttpError("INVALID_EVENT_ID", "eventId invalido", 400);
          if (!Number.isFinite(ticketQuantity) || ticketQuantity <= 0) throw new HttpError("INVALID_QUANTITY", "Quantidade invalida", 400);

          const { data: existing, error: existingError } = await supabase!
            .from("event_participants")
            .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, status, check_in_at, ticket_token, ticket_code, qr_code_data, profile:profiles!event_participants_user_id_fkey(match_enabled)")
            .eq("event_id", eventId)
            .eq("user_id", user!.id)
            .maybeSingle();

          if (existingError) throw new HttpError("PARTICIPATION_LOOKUP_FAILED", existingError.message, 400);
          if (existing) return { participant: mapParticipationRow(existing) };

          const { data: eventRow, error: eventError } = await supabase!
            .from("events")
            .select("id, event_date, end_at, status, is_active, sales_enabled, max_participants, current_participants, price")
            .eq("id", eventId)
            .single();

          if (eventError) throw new HttpError("EVENT_FETCH_FAILED", eventError.message, 400);
          if (isCanceledStatus((eventRow as any)?.status) || (eventRow as any)?.is_active === false) {
            throw new HttpError("EVENT_CANCELED", "Evento cancelado.", 400);
          }
          if ((eventRow as any)?.sales_enabled === false) {
            throw new HttpError("SALES_DISABLED", "Vendas desativadas para este evento.", 400);
          }

          const eventEndDate = new Date(((eventRow as any)?.end_at || (eventRow as any)?.event_date) as string).getTime();
          if (!Number.isNaN(eventEndDate) && Date.now() >= eventEndDate) {
            throw new HttpError("SALES_CLOSED", "Venda de ingressos encerrada", 400);
          }

          if ((eventRow as any)?.max_participants) {
            const max = Number((eventRow as any).max_participants) || 0;
            const current = Number((eventRow as any).current_participants) || 0;
            if (max > 0 && current + ticketQuantity > max) {
              throw new HttpError("EVENT_FULL", "Evento lotado", 400);
            }
          }

          if (ticketTypeId) {
            const { data: ticketType, error: ticketError } = await supabase!
              .from("ticket_types")
              .select("id, quantity_available, quantity_sold")
              .eq("id", ticketTypeId)
              .single();

            if (ticketError) throw new HttpError("TICKET_TYPE_FETCH_FAILED", ticketError.message, 400);
            const availableQuantity = Number((ticketType as any).quantity_available || 0) - Number((ticketType as any).quantity_sold || 0);
            if (availableQuantity < ticketQuantity) {
              throw new HttpError("TICKET_UNAVAILABLE", "Quantidade de ingressos indisponivel para este tipo", 400);
            }
          }

          const finalTotalPaid = totalPaid != null ? totalPaid : Number((eventRow as any)?.price || 0) * ticketQuantity;

          const { data, error } = await supabase!
            .from("event_participants")
            .insert({
              event_id: eventId,
              user_id: user!.id,
              ticket_quantity: ticketQuantity,
              ticket_type_id: ticketTypeId || null,
              total_paid: finalTotalPaid,
            } as never)
            .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, status, check_in_at, ticket_token, ticket_code, qr_code_data, profile:profiles!event_participants_user_id_fkey(match_enabled)")
            .single();

          if (error) throw new HttpError("PARTICIPATION_CREATE_FAILED", error.message, 400);
          return { participant: mapParticipationRow(data) };
        },
      );
    }

    if (req.method === "DELETE" && segments[0] === "participants" && segments[1]) {
      return withMiddleware(req, { action: "ticket_participation_leave" }, async ({ user, supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const { error } = await supabase!.from("event_participants").delete().eq("event_id", eventId).eq("user_id", user!.id);
        if (error) throw new HttpError("PARTICIPATION_DELETE_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "user" && segments[1]) {
      return withMiddleware(req, { action: "tickets_list_by_user" }, async ({ supabase }) => {
        const userId = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("event_participants")
          .select("*, event:events(*)")
          .eq("user_id", userId)
          .order("joined_at", { ascending: false });
        if (error) throw new HttpError("TICKETS_FETCH_FAILED", error.message, 400);
        return { tickets: data || [] };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0]) {
      return withMiddleware(req, { action: "ticket_get_details" }, async ({ supabase }) => {
        const ticketId = String(segments[0] || "").trim();
        const { data, error } = await supabase!.from("event_participants").select("*").eq("id", ticketId).single();
        if (error) throw new HttpError("TICKET_FETCH_FAILED", error.message, 400);
        return { ticket: data };
      });
    }

    if (req.method === "POST" && segments[0] === "validate") {
      return withMiddleware(req, { action: "ticket_validate" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ ticketId?: string; eventId?: string; token?: string }>(req);
        const ticketId = String(body.ticketId || "").trim();
        const eventId = String(body.eventId || "").trim();
        const token = String(body.token || "").trim();
        if (!ticketId || !eventId || !token) throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);

        const { data, error } = await supabase!.rpc("validate_ticket", {
          p_ticket_id: ticketId,
          p_event_id: eventId,
          p_security_token: token,
          p_validated_by: user!.id,
        });

        if (error) throw new HttpError("TICKET_VALIDATE_FAILED", error.message, 400);
        return { result: data };
      });
    }

    if (req.method === "POST" && segments[0] === "validate-scan") {
      return withMiddleware(req, { action: "ticket_validate_scan" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ code?: string; eventId?: string }>(req);
        const code = String(body.code || "").trim();
        const eventId = String(body.eventId || "").trim();
        if (!code || !eventId) throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);

        const { data, error } = await supabase!.rpc("validate_ticket_scan", {
          p_code: code,
          p_event_id: eventId,
          p_validated_by: user!.id,
        });

        if (error) throw new HttpError("TICKET_VALIDATE_SCAN_FAILED", error.message, 400);
        return { result: data };
      });
    }

    if (req.method === "POST" && segments[0] === "validate-manual") {
      return withMiddleware(req, { action: "ticket_validate_manual" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ code?: string; eventId?: string }>(req);
        const code = String(body.code || "").trim();
        const eventId = String(body.eventId || "").trim();
        if (!code || !eventId) throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);

        const { data, error } = await supabase!.rpc("validate_ticket_manual", {
          p_code: code,
          p_event_id: eventId,
          p_validated_by: user!.id,
        });

        if (error) throw new HttpError("TICKET_VALIDATE_MANUAL_FAILED", error.message, 400);
        return { result: data };
      });
    }

    if (req.method === "GET" && segments[0] === "payment-status" && segments[1]) {
      return withMiddleware(req, { action: "ticket_payment_status", requireAuth: false }, async ({ serviceClient }) => {
        const ticketId = String(segments[1] || "").trim();
        const { data, error } = await serviceClient
          .from("payments")
          .select("id, status, value, created_at, external_payment_id, ticket_id")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw new HttpError("PAYMENT_STATUS_FETCH_FAILED", error.message, 400);
        return { payment: data || null };
      });
    }

    if (req.method === "GET" && segments[0] === "coupons" && segments.length === 1) {
      return withMiddleware(req, { action: "ticket_coupons_list_active", requireAuth: false }, async ({ serviceClient }) => {
        const now = new Date().toISOString();
        const { data, error } = await serviceClient
          .from("coupons")
          .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
          .eq("active", true)
          .lte("valid_from", now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .order("created_at", { ascending: false });

        if (error) throw new HttpError("COUPONS_FETCH_FAILED", error.message, 400);
        return { coupons: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "coupons" && segments[1] === "validate") {
      return withMiddleware(req, { action: "ticket_coupon_validate", requireAuth: false }, async ({ serviceClient }) => {
        const code = String(getQueryParam(req, "code") || "").trim().toUpperCase();
        if (!code) throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);

        const now = new Date().toISOString();
        const { data: coupon, error } = await serviceClient
          .from("coupons")
          .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
          .eq("code", code)
          .eq("active", true)
          .lte("valid_from", now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .maybeSingle();

        if (error) throw new HttpError("COUPON_VALIDATE_FAILED", error.message, 400);
        if (!coupon) throw new HttpError("INVALID_COUPON", "Cupom invalido ou expirado", 400);
        if ((coupon as any).max_uses && Number((coupon as any).current_uses || 0) >= Number((coupon as any).max_uses || 0)) {
          throw new HttpError("COUPON_EXHAUSTED", "Cupom esgotado", 400);
        }

        return { coupon };
      });
    }

    if (req.method === "POST" && segments[0] === "coupons" && segments[1] === "apply") {
      return withMiddleware(req, { action: "ticket_coupon_apply" }, async ({ user, serviceClient }) => {
        const body = await parseJsonBody<{ couponId?: string; eventId?: string | null; originalPrice?: number; userId?: string }>(req);
        const couponId = String(body.couponId || "").trim();
        const eventId = body.eventId ? String(body.eventId || "").trim() : null;
        const originalPrice = Number(body.originalPrice || 0);
        if (!couponId || !Number.isFinite(originalPrice) || originalPrice < 0) {
          throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);
        }
        if (body.userId && String(body.userId).trim() !== user!.id) {
          throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);
        }

        const now = new Date().toISOString();
        const { data: coupon, error: couponError } = await serviceClient
          .from("coupons")
          .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
          .eq("id", couponId)
          .eq("active", true)
          .lte("valid_from", now)
          .or(`valid_until.is.null,valid_until.gte.${now}`)
          .maybeSingle();

        if (couponError) throw new HttpError("COUPON_FETCH_FAILED", couponError.message, 400);
        if (!coupon) throw new HttpError("INVALID_COUPON", "Cupom invalido ou expirado", 400);
        if ((coupon as any).max_uses && Number((coupon as any).current_uses || 0) >= Number((coupon as any).max_uses || 0)) {
          throw new HttpError("COUPON_EXHAUSTED", "Cupom esgotado", 400);
        }

        let discount = 0;
        if ((coupon as any).discount_type === "percentage") {
          discount = (originalPrice * Number((coupon as any).discount_value || 0)) / 100;
        } else {
          discount = Number((coupon as any).discount_value || 0);
        }
        discount = Math.max(0, Math.min(discount, originalPrice));
        const finalPrice = Number((originalPrice - discount).toFixed(2));

        const { data: usage, error: usageError } = await serviceClient
          .from("coupon_usage")
          .insert({
            coupon_id: couponId,
            user_id: user!.id,
            event_id: eventId || null,
            discount_applied: Number(discount.toFixed(2)),
          } as never)
          .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
          .single();

        if (usageError) throw new HttpError("COUPON_USAGE_CREATE_FAILED", usageError.message, 400);
        return {
          discount: Number(discount.toFixed(2)),
          finalPrice,
          couponUsage: usage,
        };
      });
    }

    if (req.method === "GET" && segments[0] === "coupons" && segments[1] === "usage") {
      return withMiddleware(req, { action: "ticket_coupon_usage_by_user" }, async ({ user, serviceClient, supabase }) => {
        const requestedUserId = String(getQueryParam(req, "userId") || "").trim() || user!.id;
        if (requestedUserId !== user!.id) {
          const { data: profile } = await supabase!.from("profiles").select("role, roles").eq("id", user!.id).maybeSingle();
          const roles = Array.isArray(profile?.roles) ? profile.roles.map((role: unknown) => String(role).toUpperCase()) : [];
          const singularRole = String(profile?.role || "").toUpperCase();
          if (singularRole !== "ADMIN" && !roles.includes("ADMIN")) throw new HttpError("FORBIDDEN", "Acesso negado", 403);
        }

        const { data, error } = await serviceClient
          .from("coupon_usage")
          .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
          .eq("user_id", requestedUserId)
          .order("used_at", { ascending: false });

        if (error) throw new HttpError("COUPON_USAGE_FETCH_FAILED", error.message, 400);
        return { usage: data || [] };
      });
    }

    if (req.method === "POST" && segments[0] === "checkout") {
      return withMiddleware(
        req,
        { action: "ticket_checkout_start", rateLimit: { endpoint: "ticket-checkout", maxRequests: 30, windowSeconds: 60 } },
        async ({ req: request }) => {
          const body = await parseJsonBody<Record<string, unknown>>(request);
          return await callLegacyFunction(request, "init-ticket-checkout-v2", {
            method: "POST",
            body,
          });
        },
      );
    }

    if (req.method === "POST" && segments[0] === "free") {
      return withMiddleware(
        req,
        { action: "ticket_issue_free", rateLimit: { endpoint: "ticket-free", maxRequests: 30, windowSeconds: 60 } },
        async ({ req: request }) => {
          const body = await parseJsonBody<Record<string, unknown>>(request);
          return await callLegacyFunction(request, "issue-free-ticket-v2", {
            method: "POST",
            body,
          });
        },
      );
    }

    if (req.method === "POST" && segments[0] === "buyer-profile") {
      return withMiddleware(req, { action: "ticket_save_buyer_profile" }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "save-buyer-profile-v2", {
          method: "POST",
          body,
        });
      });
    }

    if (req.method === "POST" && segments[0] === "payment") {
      return withMiddleware(
        req,
        { action: "ticket_create_payment", rateLimit: { endpoint: "ticket-payment", maxRequests: 30, windowSeconds: 60 } },
        async ({ req: request }) => {
          const body = await parseJsonBody<Record<string, unknown>>(request);
          const idempotencyKey = request.headers.get("Idempotency-Key");
          return await callLegacyFunction(request, "asaas-create-ticket-payment-v3", {
            method: "POST",
            body,
            headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
          });
        },
      );
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
