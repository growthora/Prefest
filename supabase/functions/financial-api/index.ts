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

type DashboardSaleTicket = {
  unit_price?: number | null;
  quantity?: number | null;
  discount_amount?: number | null;
};

type DashboardPaymentSplitRow = {
  recipient_type?: string | null;
  fee_type?: string | null;
  fee_value?: number | null;
  value?: number | null;
  status?: string | null;
};

const DASHBOARD_PLATFORM_FEE_RATE = 0.1;

function getDashboardFinancialBreakdown(
  totalPaid: number | null | undefined,
  ticket?: DashboardSaleTicket | null,
  participantQuantity?: number | null,
  organizerSplit?: DashboardPaymentSplitRow | null,
  splitBaseValue?: number | null,
) {
  const paid = Number(totalPaid) || 0;
  const splitBase = Number(splitBaseValue) > 0 ? Number(splitBaseValue) : paid;

  if (organizerSplit && paid > 0) {
    const feeType = String(organizerSplit.fee_type || "").toLowerCase();
    const feeValue = Number(organizerSplit.fee_value) || 0;
    const splitValue = Number(organizerSplit.value) || 0;

    let organizerRevenue = 0;
    if (feeType === "percentage" && feeValue > 0) {
      organizerRevenue = Number(((splitBase * feeValue) / 100).toFixed(2));
    } else if (splitValue > 0) {
      organizerRevenue = Number(splitValue.toFixed(2));
    }

    organizerRevenue = Math.min(Math.max(organizerRevenue, 0), paid);
    const platformFee = Number((paid - organizerRevenue).toFixed(2));
    return {
      customerTotal: Number(paid.toFixed(2)),
      organizerRevenue,
      platformFee: Math.max(0, platformFee),
      quantity: Number(participantQuantity) || Number(ticket?.quantity) || 1,
    };
  }

  if (ticket && typeof ticket.unit_price === "number") {
    const quantity = Number(participantQuantity) || Number(ticket.quantity) || 1;
    const unitPrice = Number(ticket.unit_price) || 0;
    const discount = Number(ticket.discount_amount) || 0;
    const organizerRevenue = Math.max(0, Number((unitPrice * quantity - discount).toFixed(2)));
    const platformFee = Number((organizerRevenue * DASHBOARD_PLATFORM_FEE_RATE).toFixed(2));
    const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
    return { customerTotal, organizerRevenue, platformFee, quantity };
  }

  if (paid <= 0) {
    return {
      customerTotal: 0,
      organizerRevenue: 0,
      platformFee: 0,
      quantity: Number(participantQuantity) || 0,
    };
  }

  const organizerRevenue = Number((paid / (1 + DASHBOARD_PLATFORM_FEE_RATE)).toFixed(2));
  const platformFee = Number((organizerRevenue * DASHBOARD_PLATFORM_FEE_RATE).toFixed(2));
  const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
  return { customerTotal, organizerRevenue, platformFee, quantity: Number(participantQuantity) || 1 };
}

async function getOrganizerEventIds(serviceClient: any, organizerId: string) {
  const { data: events, error } = await serviceClient.from("events").select("id, event_date").eq("creator_id", organizerId);
  if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
  return events || [];
}

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "financial-api");

    if (req.method === "GET" && segments[0] === "overview") {
      return withMiddleware(req, { action: "financial_overview" }, async ({ user, serviceClient, supabase }) => {
        const organizerId = String(getQueryParam(req, "organizerId") || "").trim() || user!.id;
        const isSelf = organizerId === user!.id;
        if (!isSelf) {
          const { data } = await supabase!.from("team_members").select("organizer_id").eq("user_id", user!.id).eq("organizer_id", organizerId).maybeSingle();
          if (!data) throw new HttpError("FORBIDDEN", "Acesso negado", 403);
        }

        const events = await getOrganizerEventIds(serviceClient, organizerId);
        const totalEvents = events.length || 0;
        const now = new Date().toISOString();
        const activeEvents = events.filter((event: any) => event.event_date > now).length || 0;
        const eventIds = events.map((event: any) => event.id);

        let totalSales = 0;
        let totalTicketsSold = 0;
        let totalGross = 0;
        let totalPlatformFees = 0;
        let totalNet = 0;
        let pendingNet = 0;
        let currentMonthRevenue = 0;
        let previousMonthRevenue = 0;
        let currentMonthTickets = 0;
        let previousMonthTickets = 0;
        let currentMonthParticipants = 0;
        let previousMonthParticipants = 0;

        if (eventIds.length > 0) {
          const { data: validParticipants, error: participantsError } = await serviceClient
            .from("event_participants")
            .select("ticket_id, ticket_quantity, total_paid, joined_at, status")
            .in("event_id", eventIds)
            .in("status", ["valid", "used"]);

          if (participantsError) throw new HttpError("PARTICIPANTS_FETCH_FAILED", participantsError.message, 400);

          const validTicketIds = new Set<string>();
          const participantByTicketId = new Map<string, { ticketQuantity: number; totalPaid: number; joinedAt: string | null }>();
          (validParticipants || []).forEach((participant: any) => {
            if (!participant.ticket_id) return;
            validTicketIds.add(participant.ticket_id);
            participantByTicketId.set(participant.ticket_id, {
              ticketQuantity: Number(participant.ticket_quantity) || 0,
              totalPaid: Number(participant.total_paid) || 0,
              joinedAt: participant.joined_at || null,
            });
          });

          const { data: organizerPayments, error: payError } = await serviceClient
            .from("payments")
            .select("id, status, value, asaas_net_value, created_at, ticket_id, ticket:ticket_id(event_id, unit_price, quantity, discount_amount)")
            .eq("organizer_user_id", organizerId)
            .in("status", ["paid", "received", "confirmed", "pending"]);

          if (payError) throw new HttpError("PAYMENTS_FETCH_FAILED", payError.message, 400);

          const paymentIds = (organizerPayments || []).map((payment: any) => payment.id).filter(Boolean);
          const splitByPaymentId = new Map<string, DashboardPaymentSplitRow>();

          if (paymentIds.length > 0) {
            const { data: splitRows, error: splitError } = await serviceClient
              .from("payment_splits")
              .select("payment_id, recipient_type, fee_type, fee_value, value, status")
              .in("payment_id", paymentIds)
              .eq("recipient_type", "organizer");

            if (splitError) throw new HttpError("PAYMENT_SPLITS_FETCH_FAILED", splitError.message, 400);

            (splitRows || []).forEach((row: any) => {
              if (row?.payment_id && !splitByPaymentId.has(row.payment_id)) {
                splitByPaymentId.set(row.payment_id, row);
              }
            });
          }

          const nowDate = new Date();
          const startCurrentMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
          const startNextMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1);
          const startPreviousMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);

          (organizerPayments || []).forEach((payment: any) => {
            if (payment.ticket_id && validTicketIds.size > 0 && !validTicketIds.has(payment.ticket_id)) return;
            const ticket = payment.ticket as (DashboardSaleTicket & { event_id?: string }) | null;
            if (ticket?.event_id && !eventIds.includes(ticket.event_id)) return;

            const participant = payment.ticket_id ? participantByTicketId.get(payment.ticket_id) : null;
            const breakdown = getDashboardFinancialBreakdown(
              payment.value,
              ticket,
              participant?.ticketQuantity ?? (ticket as any)?.quantity,
              splitByPaymentId.get(payment.id) || null,
              payment.asaas_net_value,
            );

            if (breakdown.customerTotal <= 0) return;
            if (payment.status === "pending") {
              pendingNet += breakdown.organizerRevenue;
              return;
            }

            totalSales += 1;
            totalTicketsSold += participant?.ticketQuantity ?? breakdown.quantity;
            totalGross += breakdown.customerTotal;
            totalPlatformFees += breakdown.platformFee;
            totalNet += breakdown.organizerRevenue;

            const referenceDate = participant?.joinedAt && participant.joinedAt.length > 0 ? participant.joinedAt : payment.created_at;
            const paymentDate = referenceDate ? new Date(referenceDate) : null;
            if (!paymentDate) return;

            if (paymentDate >= startCurrentMonth && paymentDate < startNextMonth) {
              currentMonthRevenue += breakdown.customerTotal;
              currentMonthTickets += participant?.ticketQuantity ?? breakdown.quantity;
              currentMonthParticipants += participant?.ticketQuantity ?? breakdown.quantity;
            } else if (paymentDate >= startPreviousMonth && paymentDate < startCurrentMonth) {
              previousMonthRevenue += breakdown.customerTotal;
              previousMonthTickets += participant?.ticketQuantity ?? breakdown.quantity;
              previousMonthParticipants += participant?.ticketQuantity ?? breakdown.quantity;
            }
          });
        }

        const totalWithdrawn = 0;
        return {
          totalEvents,
          activeEvents,
          totalSales,
          totalTicketsSold,
          totalRevenue: totalGross,
          totalGrossRevenue: totalGross,
          totalNetRevenue: totalNet,
          totalPlatformFees,
          availableBalance: totalNet - totalWithdrawn,
          pendingBalance: Number(pendingNet.toFixed(2)),
          totalWithdrawn,
          monthlyComparison: {
            currentMonthRevenue: Number(currentMonthRevenue.toFixed(2)),
            previousMonthRevenue: Number(previousMonthRevenue.toFixed(2)),
            currentMonthTickets,
            previousMonthTickets,
            currentMonthParticipants,
            previousMonthParticipants,
          },
        };
      });
    }

    if (req.method === "GET" && segments[0] === "sales") {
      return withMiddleware(req, { action: "financial_sales" }, async ({ user, serviceClient, supabase }) => {
        const organizerId = String(getQueryParam(req, "organizerId") || "").trim() || user!.id;
        const isSelf = organizerId === user!.id;
        if (!isSelf) {
          const { data } = await supabase!.from("team_members").select("organizer_id").eq("user_id", user!.id).eq("organizer_id", organizerId).maybeSingle();
          if (!data) throw new HttpError("FORBIDDEN", "Acesso negado", 403);
        }

        const events = await getOrganizerEventIds(serviceClient, organizerId);
        if (!events.length) return { sales: [] };
        const eventIds = events.map((event: any) => event.id);

        const { data, error } = await serviceClient
          .from("event_participants")
          .select(
            `
            id,
            joined_at,
            ticket_quantity,
            total_paid,
            status,
            ticket:ticket_id(unit_price, quantity, discount_amount),
            event:events(title),
            user:profiles!event_participants_user_id_fkey(full_name, email),
            ticket_type:ticket_types(name)
          `,
          )
          .in("event_id", eventIds)
          .order("joined_at", { ascending: false });

        if (error) throw new HttpError("SALES_FETCH_FAILED", error.message, 400);

        return {
          sales: (data || []).map((item: any) => {
            const breakdown = getDashboardFinancialBreakdown(item.total_paid, item.ticket, item.ticket_quantity);
            return {
              id: item.id,
              date: item.joined_at,
              eventName: item.event?.title || "Unknown event",
              ticketType: item.ticket_type?.name || "Default ticket",
              amount: breakdown.organizerRevenue,
              status: item.status || "pending",
              buyerName: item.user?.full_name || "User",
              buyerEmail: item.user?.email || "-",
            };
          }),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "transactions") {
      return withMiddleware(req, { action: "financial_transactions" }, async ({ user, serviceClient, supabase }) => {
        const organizerId = String(getQueryParam(req, "organizerId") || "").trim() || user!.id;
        const isSelf = organizerId === user!.id;
        if (!isSelf) {
          const { data } = await supabase!.from("team_members").select("organizer_id").eq("user_id", user!.id).eq("organizer_id", organizerId).maybeSingle();
          if (!data) throw new HttpError("FORBIDDEN", "Acesso negado", 403);
        }

        const events = await getOrganizerEventIds(serviceClient, organizerId);
        const eventIds = events.map((event: any) => event.id);
        if (!eventIds.length) return { transactions: [] };

        const { data: participants, error: participantsError } = await serviceClient
          .from("event_participants")
          .select("ticket_id, ticket_quantity, total_paid, joined_at, user:profiles!event_participants_user_id_fkey(full_name, email)")
          .in("event_id", eventIds);

        if (participantsError) throw new HttpError("PARTICIPANTS_FETCH_FAILED", participantsError.message, 400);

        const participantByTicketId = new Map<string, any>();
        (participants || []).forEach((participant: any) => {
          if (!participant?.ticket_id) return;
          participantByTicketId.set(participant.ticket_id, {
            ticketQuantity: Number(participant.ticket_quantity) || 0,
            totalPaid: Number(participant.total_paid) || 0,
            joinedAt: participant.joined_at || null,
            buyerName: participant.user?.full_name || "Usuario",
            buyerEmail: participant.user?.email || "-",
          });
        });

        const { data: payments, error: paymentsError } = await serviceClient
          .from("payments")
          .select("id, status, value, created_at, payment_method, asaas_net_value, ticket_id, ticket:ticket_id(event_id, unit_price, quantity, discount_amount, event:events(title))")
          .eq("organizer_user_id", organizerId)
          .order("created_at", { ascending: false });

        if (paymentsError) throw new HttpError("PAYMENTS_FETCH_FAILED", paymentsError.message, 400);

        const paymentIds = (payments || []).map((payment: any) => payment.id).filter(Boolean);
        const splitByPaymentId = new Map<string, DashboardPaymentSplitRow>();
        if (paymentIds.length > 0) {
          const { data: splitRows, error: splitError } = await serviceClient
            .from("payment_splits")
            .select("payment_id, recipient_type, fee_type, fee_value, value, status")
            .in("payment_id", paymentIds)
            .eq("recipient_type", "organizer");

          if (splitError) throw new HttpError("PAYMENT_SPLITS_FETCH_FAILED", splitError.message, 400);
          (splitRows || []).forEach((row: any) => {
            if (row?.payment_id && !splitByPaymentId.has(row.payment_id)) {
              splitByPaymentId.set(row.payment_id, row);
            }
          });
        }

        return {
          transactions: (payments || [])
            .map((payment: any) => {
              const ticket = payment.ticket as (DashboardSaleTicket & { event?: { title?: string | null } }) | null;
              const participant = payment.ticket_id ? participantByTicketId.get(payment.ticket_id) : null;
              const breakdown = getDashboardFinancialBreakdown(
                payment.value,
                ticket,
                participant?.ticketQuantity ?? (ticket as any)?.quantity,
                splitByPaymentId.get(payment.id) || null,
                payment.asaas_net_value,
              );

              return {
                id: payment.id,
                date: participant?.joinedAt || payment.created_at,
                eventName: (ticket as any)?.event?.title || "Evento",
                buyerName: participant?.buyerName || "Usuario",
                buyerEmail: participant?.buyerEmail || "-",
                paymentMethod: String(payment.payment_method || "unknown"),
                grossAmount: breakdown.customerTotal,
                platformFee: breakdown.platformFee,
                netAmount: breakdown.organizerRevenue,
                status: String(payment.status || "pending"),
              };
            })
            .filter((payment: any) => payment.grossAmount > 0),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "chart") {
      return withMiddleware(req, { action: "financial_chart" }, async ({ user, serviceClient, supabase }) => {
        const organizerId = String(getQueryParam(req, "organizerId") || "").trim() || user!.id;
        const period = String(getQueryParam(req, "period") || "week");
        const isSelf = organizerId === user!.id;
        if (!isSelf) {
          const { data } = await supabase!.from("team_members").select("organizer_id").eq("user_id", user!.id).eq("organizer_id", organizerId).maybeSingle();
          if (!data) throw new HttpError("FORBIDDEN", "Acesso negado", 403);
        }

        const events = await getOrganizerEventIds(serviceClient, organizerId);
        const eventIds = events.map((event: any) => event.id);
        if (!eventIds.length) return { chart: [] };

        const nowDate = new Date();
        const startDate = new Date();
        const days = period === "month" ? 30 : period === "day" ? 1 : 7;
        startDate.setDate(nowDate.getDate() - days);

        const { data: sales, error } = await serviceClient
          .from("event_participants")
          .select("joined_at, ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount)")
          .in("event_id", eventIds)
          .gte("joined_at", startDate.toISOString())
          .in("status", ["valid", "used"]);

        if (error) throw new HttpError("CHART_FETCH_FAILED", error.message, 400);

        const salesMap = new Map<string, { amount: number; count: number }>();
        for (let i = 0; i < days; i += 1) {
          const date = new Date();
          date.setDate(nowDate.getDate() - i);
          const key = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          salesMap.set(key, { amount: 0, count: 0 });
        }

        (sales || []).forEach((sale: any) => {
          const date = new Date(sale.joined_at);
          const key = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (!salesMap.has(key)) return;
          const current = salesMap.get(key)!;
          const breakdown = getDashboardFinancialBreakdown(sale.total_paid, sale.ticket, sale.ticket_quantity);
          if (breakdown.customerTotal <= 0) return;
          salesMap.set(key, {
            amount: current.amount + breakdown.customerTotal,
            count: current.count + 1,
          });
        });

        return {
          chart: Array.from(salesMap.entries())
            .map(([date, data]) => ({ date, amount: data.amount, count: data.count }))
            .reverse(),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "asaas" && segments[1] === "account") {
      return withMiddleware(req, { action: "financial_get_asaas_account" }, async ({ user, serviceClient, supabase }) => {
        const organizerUserId = String(getQueryParam(req, "organizerUserId") || "").trim() || user!.id;
        if (organizerUserId !== user!.id) {
          const { data } = await supabase!.from("profiles").select("role, roles").eq("id", user!.id).maybeSingle();
          const roles = Array.isArray(data?.roles) ? data.roles.map((role: unknown) => String(role).toUpperCase()) : [];
          const singularRole = String(data?.role || "").toUpperCase();
          if (singularRole !== "ADMIN" && !roles.includes("ADMIN")) {
            throw new HttpError("FORBIDDEN", "Acesso negado", 403);
          }
        }

        const { data, error } = await serviceClient
          .from("organizer_asaas_accounts")
          .select("id, organizer_user_id, asaas_account_id, asaas_wallet_id, external_wallet_id, is_active, kyc_status, created_at, updated_at")
          .eq("organizer_user_id", organizerUserId)
          .maybeSingle();

        if (error) throw new HttpError("ASAAS_ACCOUNT_FETCH_FAILED", error.message, 400);
        return { account: data || null };
      });
    }

    if (req.method === "GET" && segments[0] === "admin" && segments[1] === "overview") {
      return withMiddleware(req, { action: "financial_admin_overview", roles: ["ADMIN"] }, async ({ req: request }) => {
        const qs = new URLSearchParams();
        const dateStart = getQueryParam(request, "dateStart");
        const dateEnd = getQueryParam(request, "dateEnd");
        qs.set("type", "overview");
        if (dateStart) qs.set("dateStart", dateStart);
        if (dateEnd) qs.set("dateEnd", dateEnd);
        return await callLegacyFunction(request, `admin-financial-dashboard?${qs.toString()}`, { method: "GET" });
      });
    }

    if (req.method === "GET" && segments[0] === "admin" && segments[1] === "transactions") {
      return withMiddleware(req, { action: "financial_admin_transactions", roles: ["ADMIN"] }, async ({ req: request }) => {
        const qs = new URLSearchParams();
        qs.set("type", "payments");
        for (const key of ["page", "pageSize", "status", "dateStart", "dateEnd"]) {
          const value = getQueryParam(request, key);
          if (value) qs.set(key, value);
        }
        return await callLegacyFunction(request, `admin-financial-dashboard?${qs.toString()}`, { method: "GET" });
      });
    }

    if (req.method === "POST" && segments[0] === "admin" && segments[1] === "reconcile" && segments[2]) {
      return withMiddleware(req, { action: "financial_admin_reconcile", roles: ["ADMIN"] }, async ({ req: request }) => {
        const paymentId = String(segments[2] || "").trim();
        assertCondition(paymentId, "INVALID_PAYMENT_ID", "Pagamento invalido", 400);
        return await callLegacyFunction(request, `admin-financial-dashboard?type=reconcile&id=${encodeURIComponent(paymentId)}`, { method: "GET" });
      });
    }

    if (req.method === "POST" && segments[0] === "admin" && segments[1] === "reconcile-all") {
      return withMiddleware(req, { action: "financial_admin_reconcile_all", roles: ["ADMIN"] }, async ({ req: request }) => {
        const limit = getQueryParam(request, "limit") || "500";
        return await callLegacyFunction(request, `admin-financial-dashboard?type=reconcile-all&limit=${encodeURIComponent(limit)}`, { method: "GET" });
      });
    }

    if (req.method === "GET" && segments[0] === "refunds" && segments.length === 1) {
      return withMiddleware(req, { action: "financial_refunds_get_my_data" }, async ({ req: request }) => {
        return await callLegacyFunction(request, "refund-requests", { method: "GET" });
      });
    }

    if (req.method === "POST" && segments[0] === "refunds" && segments.length === 1) {
      return withMiddleware(req, { action: "financial_refunds_create" }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "refund-requests", {
          method: "POST",
          body,
        });
      });
    }

    if (req.method === "PATCH" && segments[0] === "refunds" && segments.length === 1) {
      return withMiddleware(req, { action: "financial_refunds_update", roles: ["ADMIN"] }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "refund-requests", {
          method: "PATCH",
          body,
        });
      });
    }

    if (req.method === "GET" && segments[0] === "admin" && segments[1] === "refunds") {
      return withMiddleware(req, { action: "financial_admin_refunds_list", roles: ["ADMIN"] }, async ({ req: request }) => {
        return await callLegacyFunction(request, "refund-requests?scope=admin", { method: "GET" });
      });
    }

    if (req.method === "PUT" && segments[0] === "asaas" && segments[1] === "account") {
      return withMiddleware(req, { action: "financial_connect_asaas_wallet" }, async ({ user, serviceClient }) => {
        const body = await parseJsonBody<{ walletId?: string; externalEmail?: string }>(req);
        const walletId = String(body.walletId || "").trim();
        const externalEmail = String(body.externalEmail || "").trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(walletId);

        assertCondition(walletId && isUuid, "INVALID_WALLET_ID", "Wallet ID invalido", 400);
        assertCondition(externalEmail, "INVALID_EMAIL", "E-mail invalido", 400);

        const { data, error } = await serviceClient
          .from("organizer_asaas_accounts")
          .upsert(
            {
              organizer_user_id: user!.id,
              asaas_account_id: walletId,
              asaas_wallet_id: walletId,
              is_active: true,
              kyc_status: "approved",
              payment_method_type: "EXTERNAL_WALLET",
              external_wallet_id: walletId,
              external_wallet_email: externalEmail,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "organizer_user_id" },
          )
          .select("id, organizer_user_id, asaas_account_id, asaas_wallet_id, external_wallet_id, is_active, kyc_status, created_at, updated_at")
          .single();

        if (error) throw new HttpError("ASAAS_ACCOUNT_UPSERT_FAILED", error.message, 400);
        return { account: data };
      });
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
