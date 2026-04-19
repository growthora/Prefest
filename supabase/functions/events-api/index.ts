import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TicketTypeRow = {
  id: string;
  price: number | null;
  quantity_available: number | null;
  quantity_sold: number | null;
  is_active: boolean | null;
  is_test: boolean | null;
  is_internal: boolean | null;
  is_hidden: boolean | null;
  sale_start_date: string | null;
  sale_end_date: string | null;
};

type EventImageRow = {
  id: string;
  event_id: string;
  image_url: string;
  is_cover: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string;
  end_at: string | null;
  location: string;
  state: string | null;
  city: string | null;
  event_type: string;
  image_url: string | null;
  category: string | null;
  category_id: string | null;
  status: string;
  price: number | null;
  is_paid_event: boolean | null;
  max_participants: number | null;
  current_participants: number | null;
  is_active: boolean | null;
  sales_enabled: boolean | null;
  ticket_types?: TicketTypeRow[];
};

type ManagedEvent = ReturnType<typeof mapEventForClient> & {
  revenue?: number;
  ticketsSold?: number;
  totalTicketsConfigured?: number;
};

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getAnonClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuração inválida");
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function responseFromThrownError(req: Request, error: unknown) {
  if (!(error instanceof Response)) {
    return null;
  }

  const contentType = error.headers.get("Content-Type") || "application/json; charset=utf-8";
  const rawBody = await error.text();
  const body = rawBody || JSON.stringify({ error: error.statusText || "Erro na requisição" });

  return new Response(body, {
    status: error.status || 500,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": contentType,
    },
  });
}

function calculateEventDisplayPrice(tickets: TicketTypeRow[]) {
  const now = new Date();

  const activeTickets = (tickets || []).filter((ticket) => {
    const isVisible =
      (ticket.is_active ?? true) &&
      !ticket.is_test &&
      !ticket.is_internal &&
      !ticket.is_hidden;

    const hasInventory =
      Number(ticket.quantity_available || 0) > Number(ticket.quantity_sold || 0);

    const saleStarted = !ticket.sale_start_date || new Date(ticket.sale_start_date) <= now;
    const saleNotEnded = !ticket.sale_end_date || new Date(ticket.sale_end_date) >= now;

    return isVisible && hasInventory && saleStarted && saleNotEnded;
  });

  if (activeTickets.length === 0) {
    return {
      display_price_label: "",
      display_price_value: undefined as number | undefined,
      is_free_event: false,
    };
  }

  const minPrice = Math.min(...activeTickets.map((ticket) => Number(ticket.price) || 0));

  if (minPrice > 0) {
    const formattedPrice = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(minPrice);

    return {
      display_price_label: `Ingressos a partir de ${formattedPrice}`,
      display_price_value: minPrice,
      is_free_event: false,
    };
  }

  return {
    display_price_label: "Evento gratuito",
    display_price_value: 0,
    is_free_event: true,
  };
}

function mapEventForClient(row: EventRow) {
  const tickets = Array.isArray(row.ticket_types) ? row.ticket_types : [];
  const priceInfo = calculateEventDisplayPrice(tickets);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    event_date: row.event_date,
    end_at: row.end_at,
    location: row.location,
    state: row.state,
    city: row.city,
    event_type: row.event_type,
    image_url: row.image_url,
    category: row.category,
    category_id: row.category_id,
    status: row.status,
    price: Number(row.price || 0),
    max_participants: row.max_participants,
    current_participants: Number(row.current_participants || 0),
    is_active: row.is_active ?? true,
    sales_enabled: row.sales_enabled ?? true,
    is_paid_event: row.is_paid_event ?? undefined,
    ...priceInfo,
  };
}

function generateSlug(rawTitle: string) {
  const base = String(rawTitle || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || "evento";
}

function pickEventUpdateFields(input: any) {
  const allowedKeys = new Set([
    "title",
    "description",
    "event_date",
    "end_at",
    "location",
    "state",
    "city",
    "event_type",
    "image_url",
    "category",
    "category_id",
    "status",
    "price",
    "max_participants",
    "is_active",
    "sales_enabled",
    "is_paid_event",
    "asaas_required",
  ]);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (allowedKeys.has(key)) out[key] = value;
  }

  out.updated_at = new Date().toISOString();
  return out;
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function isAdminProfile(profile: any): boolean {
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const role = String(profile?.role || "").toUpperCase();
  const normalizedRoles = roles.map((r: any) => String(r).toUpperCase());
  return role === "ADMIN" || normalizedRoles.includes("ADMIN");
}

async function requireAdmin(req: Request, supabaseUserClient: any, userId: string) {
  const { data: profile, error } = await supabaseUserClient
    .from("profiles")
    .select("roles, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw jsonResponse(req, { error: error.message }, 400);
  if (!isAdminProfile(profile)) throw jsonResponse(req, { error: "Acesso negado" }, 403);
}

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceKey) throw new Error("Configuração inválida");
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function requireOrganizerAccess(req: Request, serviceClient: any, userId: string, organizerId: string) {
  if (!organizerId) throw jsonResponse(req, { error: "Parâmetros inválidos" }, 400);
  if (organizerId === userId) return;

  const { data, error } = await serviceClient
    .from("team_members")
    .select("organizer_id")
    .eq("user_id", userId)
    .eq("organizer_id", organizerId)
    .maybeSingle();

  if (error) throw jsonResponse(req, { error: error.message }, 400);
  if (!data) throw jsonResponse(req, { error: "Acesso negado" }, 403);
}

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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const payload = await req.json().catch(() => ({}));
    const op = String(payload?.op || "");
    const params = payload?.params ?? {};

    if (!op) {
      return jsonResponse(req, { error: "Operação inválida" }, 400);
    }

    if (op === "auth.checkRegistrationData") {
      const email = String(params?.email || "").trim();
      const cpf = String(params?.cpf || "").trim();
      if (!email || !cpf) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const anon = getAnonClient();
      const { data, error } = await anon.rpc("check_registration_data", {
        check_email: email,
        check_cpf: cpf,
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, data || { email_exists: false, cpf_exists: false });
    }

    if (op === "eventRequests.create") {
      const data = params?.data ?? {};
      const user_name = String(data?.user_name || "").trim();
      const event_name = String(data?.event_name || "").trim();
      const email = String(data?.email || "").trim();
      const phone = String(data?.phone || "").trim();
      const city = String(data?.city || "").trim();
      const event_location = String(data?.event_location || "").trim();

      if (!user_name || !event_name || !email || !phone || !city || !event_location) {
        return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);
      }

      const anon = getAnonClient();
      const { data: request, error } = await anon
        .from("event_requests")
        .insert({
          user_name,
          event_name,
          email,
          phone,
          city,
          event_location,
          status: "pending",
        } as any)
        .select("id, user_name, event_name, email, phone, city, event_location, status, notes, created_at, updated_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { request });
    }

    if (op === "events.listPublic") {
      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .order("event_date", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "events.getBySlugPublic") {
      const slug = String(params?.slug || "").trim();
      if (!slug) return jsonResponse(req, { error: "Slug inválido" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("slug", slug)
        .eq("status", "published")
        .eq("is_active", true)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      if (!data) return jsonResponse(req, { error: "Evento não encontrado" }, 404);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.getByIdPublic") {
      const id = String(params?.id || "").trim();
      if (!id) return jsonResponse(req, { error: "ID inválido" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("id", id)
        .eq("status", "published")
        .eq("is_active", true)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      if (!data) return jsonResponse(req, { error: "Evento não encontrado" }, 404);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.trendingPublic") {
      const limit = Math.min(Number(params?.limit || 20), 50);
      const nowIso = new Date().toISOString();

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, tickets_sold, views, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .gte("event_date", nowIso);

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const events = (data || []) as Array<EventRow & { tickets_sold?: number | null; views?: number | null }>;
      const scored = events
        .map((event) => {
          const tickets = typeof (event as any).tickets_sold === "number" ? Number((event as any).tickets_sold) : 0;
          const views = typeof (event as any).views === "number" ? Number((event as any).views) : 0;
          const score = tickets * 0.6 + views * 0.4;
          return { event: mapEventForClient(event), score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.event)
        .slice(0, limit);

      return jsonResponse(req, { events: scored });
    }

    if (op === "events.listNewPublic") {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date), created_at",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .gte("event_date", now.toISOString())
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "eventImages.listPublic") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data: eventRow, error: eventError } = await serviceClient
        .from("events")
        .select("status, is_active")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError) return jsonResponse(req, { error: eventError.message }, 400);
      if (!eventRow || (eventRow as any).is_active !== true || (eventRow as any).status !== "published") {
        return jsonResponse(req, { images: [] });
      }

      const { data, error } = await serviceClient
        .from("event_images")
        .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { images: (data || []) as EventImageRow[] });
    }

    if (op === "ticketTypes.listForEventPublic") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "Event ID inválido" }, 400);

      const serviceClient = getServiceRoleClient();
      const nowIso = new Date().toISOString();
      const { data: eventRow, error: eventError } = await serviceClient
        .from("events")
        .select("end_at, event_date, sales_enabled, status, is_active")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError) return jsonResponse(req, { error: eventError.message }, 400);

      const normalizedStatus = String((eventRow as any)?.status || "").toLowerCase();
      const isCanceled =
        normalizedStatus === "cancelado" ||
        normalizedStatus === "canceled" ||
        normalizedStatus === "cancelled";

      if (!eventRow || (eventRow as any)?.status !== "published") {
        return jsonResponse(req, { ticket_types: [] });
      }

      const eventEndAt = new Date(((eventRow as any)?.end_at || (eventRow as any)?.event_date || nowIso) as string).getTime();
      if ((eventRow as any)?.is_active === false || isCanceled || (eventRow as any)?.sales_enabled === false) {
        return jsonResponse(req, { ticket_types: [] });
      }

      if (!Number.isNaN(eventEndAt) && Date.now() >= eventEndAt) {
        return jsonResponse(req, { ticket_types: [] });
      }

      const { data, error } = await serviceClient
        .from("ticket_types")
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date, created_at, updated_at")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .or(`sale_start_date.is.null,sale_start_date.lte.${nowIso}`)
        .or(`sale_end_date.is.null,sale_end_date.gte.${nowIso}`)
        .order("price", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const rows = (data || [])
        .filter((ticket: any) => !ticket.is_test && !ticket.is_internal && !ticket.is_hidden)
        .filter((ticket: any) => Number(ticket.quantity_sold || 0) < Number(ticket.quantity_available || 0));

      return jsonResponse(req, { ticket_types: rows });
    }

    if (op === "categories.withUpcomingCountsPublic") {
      const now = new Date().toISOString();
      const serviceClient = getServiceRoleClient();

      const [{ data: categories, error: categoriesError }, { data: events, error: eventsError }] = await Promise.all([
        serviceClient.from("categories").select("id, name, icon, description, is_active, created_at, updated_at").eq("is_active", true).order("name"),
        serviceClient.from("events").select("id, category_id, event_date, status, is_active").eq("status", "published").eq("is_active", true).gte("event_date", now),
      ]);

      if (categoriesError) return jsonResponse(req, { error: categoriesError.message }, 400);
      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);

      const countByCategory = new Map<string, number>();
      (events || []).forEach((row: any) => {
        const categoryId = row?.category_id as string | null;
        if (!categoryId) return;
        countByCategory.set(categoryId, (countByCategory.get(categoryId) || 0) + 1);
      });

      const result = (categories || []).map((category: any) => ({
        ...category,
        upcoming_events_count: countByCategory.get(category.id) || 0,
      }));

      return jsonResponse(req, { categories: result });
    }

    const { user, supabase } = await requireAuth(req);

    if (op === "events.list") {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .order("event_date", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "events.listAll") {
      const includeDrafts = Boolean(params?.includeDrafts);
      const includeInactive = Boolean(params?.includeInactive);

      let query = supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .order("event_date", { ascending: true });

      if (!includeDrafts) {
        query = query.eq("status", "published");
      }

      if (!includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "events.getBySlug") {
      const slug = String(params?.slug || "").trim();
      if (!slug) return jsonResponse(req, { error: "Slug inválido" }, 400);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("slug", slug)
        .eq("status", "published")
        .eq("is_active", true)
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.getById") {
      const id = String(params?.id || "").trim();
      if (!id) return jsonResponse(req, { error: "ID inválido" }, 400);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("id", id)
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "categories.list") {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { categories: data || [] });
    }

    if (op === "genders.list") {
      const { data, error } = await supabase
        .from("genders")
        .select("code, label")
        .order("sort_order", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { genders: data || [] });
    }

    if (op === "ticketTypes.listForEvent") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "Event ID inválido" }, 400);

      const nowIso = new Date().toISOString();
      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("end_at, event_date, sales_enabled, status, is_active")
        .eq("id", eventId)
        .single();

      if (eventError) return jsonResponse(req, { error: eventError.message }, 400);

      const normalizedStatus = String((eventRow as any)?.status || "").toLowerCase();
      const isCanceled =
        normalizedStatus === "cancelado" ||
        normalizedStatus === "canceled" ||
        normalizedStatus === "cancelled";
      const eventEndAt = new Date(((eventRow as any)?.end_at || (eventRow as any)?.event_date || nowIso) as string).getTime();

      if ((eventRow as any)?.is_active === false || isCanceled || (eventRow as any)?.sales_enabled === false) {
        return jsonResponse(req, { ticket_types: [] });
      }

      if (!Number.isNaN(eventEndAt) && Date.now() >= eventEndAt) {
        return jsonResponse(req, { ticket_types: [] });
      }

      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date, created_at, updated_at")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .or(`sale_start_date.is.null,sale_start_date.lte.${nowIso}`)
        .or(`sale_end_date.is.null,sale_end_date.gte.${nowIso}`)
        .order("price", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const rows = (data || [])
        .filter((ticket: any) => !ticket.is_test && !ticket.is_internal && !ticket.is_hidden)
        .filter((ticket: any) => Number(ticket.quantity_sold || 0) < Number(ticket.quantity_available || 0));

      return jsonResponse(req, { ticket_types: rows });
    }

    if (op === "events.listNew") {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date), created_at",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .gte("event_date", now.toISOString())
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "organizer.getManagedOrganizerId") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("roles, role")
        .eq("id", user.id)
        .single();

      if (profileError) return jsonResponse(req, { error: profileError.message }, 400);

      const roles = ((profile as any)?.roles || []).map((role: string) => String(role).toUpperCase());
      const isEquipeOnly = roles.includes("EQUIPE") && !roles.includes("ORGANIZER") && !roles.includes("ADMIN");

      if (!isEquipeOnly) {
        return jsonResponse(req, { organizerId: user.id });
      }

      const { data: teamRow, error: teamError } = await supabase
        .from("team_members")
        .select("organizer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (teamError) return jsonResponse(req, { error: teamError.message }, 400);

      return jsonResponse(req, { organizerId: String((teamRow as any)?.organizer_id || user.id) });
    }

    if (op === "organizer.eventsByCreator") {
      const creatorId = String(params?.creatorId || "").trim() || user.id;

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false });

      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);
      if (!events || events.length === 0) return jsonResponse(req, { events: [] as ManagedEvent[] });

      const eventIds = (events || []).map((e: any) => e.id);

      const [{ data: participants }, { data: ticketTypes }] = await Promise.all([
        supabase
          .from("event_participants")
          .select("event_id, ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount), status")
          .in("event_id", eventIds as any)
          .in("status", ["valid", "used", "paid", "confirmed"]),
        supabase
          .from("ticket_types")
          .select("event_id, quantity_available")
          .in("event_id", eventIds as any),
      ]);

      const revenueMap = new Map<string, number>();
      const ticketsMap = new Map<string, number>();
      const capacityMap = new Map<string, number>();

      (participants || []).forEach((p: any) => {
        const ticket = p.ticket as { unit_price?: number | null; quantity?: number | null; discount_amount?: number | null } | null;

        let organizerAmount = 0;
        if (ticket && typeof ticket.unit_price === "number") {
          const qty = Number(p.ticket_quantity) || Number(ticket.quantity) || 1;
          const discount = Number(ticket.discount_amount) || 0;
          const gross = Math.max(0, Number((Number(ticket.unit_price) * qty - discount).toFixed(2)));
          organizerAmount = Number((gross * 0.9).toFixed(2));
        } else {
          const paid = Number(p.total_paid) || 0;
          const gross = paid > 0 ? Number((paid / 1.1).toFixed(2)) : 0;
          organizerAmount = gross > 0 ? Number((gross * 0.9).toFixed(2)) : 0;
        }

        revenueMap.set(p.event_id, (revenueMap.get(p.event_id) || 0) + organizerAmount);
        ticketsMap.set(p.event_id, (ticketsMap.get(p.event_id) || 0) + (Number(p.ticket_quantity) || 0));
      });

      (ticketTypes || []).forEach((t: any) => {
        capacityMap.set(t.event_id, (capacityMap.get(t.event_id) || 0) + (Number(t.quantity_available) || 0));
      });

      const result = (events || []).map((event: any) => ({
        ...mapEventForClient(event as EventRow),
        revenue: revenueMap.get(event.id) || 0,
        ticketsSold: ticketsMap.get(event.id) || 0,
        totalTicketsConfigured: capacityMap.get(event.id) || 0,
      }));

      return jsonResponse(req, { events: result });
    }

    if (op === "events.create") {
      const eventData = params?.eventData ?? {};
      const title = String(eventData?.title || "").trim();
      if (!title) return jsonResponse(req, { error: "Título é obrigatório" }, 400);

      let slug = generateSlug(title);
      const { count, error: countError } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("slug", slug);

      if (countError) return jsonResponse(req, { error: countError.message }, 400);
      if (count && count > 0) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
      }

      const eventToInsert = {
        ...eventData,
        slug,
        creator_id: user.id,
        category_id: eventData?.category_id || null,
        category: eventData?.category || null,
        image_url: eventData?.image_url || null,
        max_participants: eventData?.max_participants || null,
        is_paid_event: eventData?.is_paid_event ?? false,
        sales_enabled: eventData?.sales_enabled ?? false,
        asaas_required: eventData?.asaas_required ?? true,
        is_active: true,
      };

      const { data, error } = await supabase
        .from("events")
        .insert(eventToInsert)
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.update") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const updates = pickEventUpdateFields(params?.updates);

      const { data, error } = await supabase
        .from("events")
        .update(updates as any)
        .eq("id", eventId)
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.deactivate") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("events")
        .update({
          is_active: false,
          sales_enabled: false,
          status: "draft",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", eventId)
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "events.reactivate") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("events")
        .update({
          is_active: true,
          status: "published",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", eventId)
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { event: mapEventForClient(data as EventRow) });
    }

    if (op === "participants.get") {
      const eventId = String(params?.eventId || "").trim();
      const userId = String(params?.userId || "").trim() || user.id;
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("event_participants")
        .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, match_enabled, status, check_in_at, security_token, ticket_code, qr_code_data")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { participation: data || null });
    }

    if (op === "participants.join") {
      const eventId = String(params?.eventId || "").trim();
      const ticketQuantity = Number(params?.ticketQuantity || 1);
      const ticketTypeId = params?.ticketTypeId ? String(params.ticketTypeId).trim() : null;
      const totalPaid = params?.totalPaid != null ? Number(params.totalPaid) : null;

      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);
      if (!Number.isFinite(ticketQuantity) || ticketQuantity <= 0) return jsonResponse(req, { error: "Quantidade inválida" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("event_participants")
        .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, match_enabled, status, check_in_at, security_token, ticket_code, qr_code_data")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) return jsonResponse(req, { error: existingError.message }, 400);
      if (existing) return jsonResponse(req, { participant: existing });

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("id, event_date, end_at, status, is_active, sales_enabled, max_participants, current_participants, price")
        .eq("id", eventId)
        .single();

      if (eventError) return jsonResponse(req, { error: eventError.message }, 400);

      const normalizedStatus = String((eventRow as any)?.status || "").toLowerCase();
      const isCanceled =
        normalizedStatus === "cancelado" ||
        normalizedStatus === "canceled" ||
        normalizedStatus === "cancelled";

      if (isCanceled || (eventRow as any)?.is_active === false) {
        return jsonResponse(req, { error: "Evento cancelado." }, 400);
      }

      if ((eventRow as any)?.sales_enabled === false) {
        return jsonResponse(req, { error: "Vendas desativadas para este evento." }, 400);
      }

      const eventEndDate = new Date(((eventRow as any)?.end_at || (eventRow as any)?.event_date) as string).getTime();
      if (!Number.isNaN(eventEndDate) && Date.now() >= eventEndDate) {
        return jsonResponse(req, { error: "Venda de ingressos encerrada" }, 400);
      }

      if ((eventRow as any)?.max_participants) {
        const max = Number((eventRow as any).max_participants) || 0;
        const current = Number((eventRow as any).current_participants) || 0;
        if (max > 0 && current + ticketQuantity > max) {
          return jsonResponse(req, { error: "Evento lotado" }, 400);
        }
      }

      if (ticketTypeId) {
        const { data: ticketType, error: ticketError } = await supabase
          .from("ticket_types")
          .select("id, quantity_available, quantity_sold")
          .eq("id", ticketTypeId)
          .single();

        if (ticketError) return jsonResponse(req, { error: ticketError.message }, 400);

        const availableQuantity = Number(ticketType.quantity_available || 0) - Number(ticketType.quantity_sold || 0);
        if (availableQuantity < ticketQuantity) {
          return jsonResponse(req, { error: "Quantidade de ingressos indisponível para este tipo" }, 400);
        }
      }

      const finalTotalPaid =
        totalPaid != null ? totalPaid : Number((eventRow as any)?.price || 0) * ticketQuantity;

      const { data, error } = await supabase
        .from("event_participants")
        .insert({
          event_id: eventId,
          user_id: user.id,
          ticket_quantity: ticketQuantity,
          ticket_type_id: ticketTypeId || null,
          total_paid: finalTotalPaid,
          match_enabled: false,
        })
        .select("id, event_id, user_id, ticket_quantity, ticket_type_id, total_paid, joined_at, match_enabled, status, check_in_at, security_token, ticket_code, qr_code_data")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { participant: data });
    }

    if (op === "participants.leave") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { error } = await supabase
        .from("event_participants")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "participants.list") {
      const eventId = String(params?.eventId || "").trim();
      const limit = Math.min(Number(params?.limit || 100), 500);
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("event_participants")
        .select(
          `
          id,
          status,
          match_enabled,
          user:profiles!event_participants_user_id_fkey!inner(
            id,
            full_name,
            avatar_url
          )
        `,
        )
        .eq("event_id", eventId)
        .limit(limit);

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const participants = (data || []).map((p: any) => ({
        id: p.id,
        userId: p.user.id,
        name: p.user.full_name || "Usuário",
        avatar_url: p.user.avatar_url,
        status: p.status,
        match_enabled: p.match_enabled,
      }));

      return jsonResponse(req, { participants });
    }

    if (op === "eventImages.list") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("event_images")
        .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
        .eq("event_id", eventId)
        .order("display_order", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { images: (data || []) as EventImageRow[] });
    }

    if (op === "eventImages.set") {
      const eventId = String(params?.eventId || "").trim();
      const images = Array.isArray(params?.images) ? params.images : [];
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);
      if (images.length === 0) return jsonResponse(req, { error: "Imagens inválidas" }, 400);

      const normalized = images
        .filter((img: any) => typeof img?.image_url === "string" && img.image_url.trim().length > 0)
        .map((img: any, index: number) => ({
          event_id: eventId,
          image_url: String(img.image_url).trim(),
          is_cover: Boolean(img.is_cover),
          display_order: Number.isFinite(Number(img.display_order)) ? Number(img.display_order) : index,
        }))
        .slice(0, 5);

      if (normalized.length === 0) return jsonResponse(req, { error: "Imagens inválidas" }, 400);

      const coverIndex = normalized.findIndex((img: any) => img.is_cover);
      const withCover = normalized.map((img: any, index: number) => ({
        ...img,
        is_cover: coverIndex >= 0 ? index === coverIndex : index === 0,
        display_order: index,
      }));

      const cover = withCover.find((img: any) => img.is_cover) || withCover[0];
      const payloadToInsert = withCover.sort((a: any, b: any) => Number(b.is_cover) - Number(a.is_cover));

      const { error: deleteError } = await supabase
        .from("event_images")
        .delete()
        .eq("event_id", eventId);

      if (deleteError) return jsonResponse(req, { error: deleteError.message }, 400);

      const { data: inserted, error: insertError } = await supabase
        .from("event_images")
        .insert(payloadToInsert)
        .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
        .order("display_order", { ascending: true });

      if (insertError) return jsonResponse(req, { error: insertError.message }, 400);

      const { error: eventUpdateError } = await supabase
        .from("events")
        .update({ image_url: cover.image_url, updated_at: new Date().toISOString() } as any)
        .eq("id", eventId);

      if (eventUpdateError) return jsonResponse(req, { error: eventUpdateError.message }, 400);

      return jsonResponse(req, { images: (inserted || []) as EventImageRow[] });
    }

    if (op === "ticketTypes.createMany") {
      const eventId = String(params?.eventId || "").trim();
      const ticketTypes = Array.isArray(params?.ticketTypes) ? params.ticketTypes : [];
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);
      if (ticketTypes.length === 0) return jsonResponse(req, { error: "ticketTypes inválido" }, 400);

      const payload = ticketTypes.map((ticket: any) => ({
        event_id: eventId,
        name: String(ticket?.name || "").trim(),
        description: ticket?.description ?? null,
        price: Number(ticket?.price) || 0,
        quantity_available: Number(ticket?.quantity_available) || 0,
        sale_start_date: ticket?.sale_start_date ?? null,
        sale_end_date: ticket?.sale_end_date ?? null,
      }));

      if (payload.some((t: any) => !t.name)) return jsonResponse(req, { error: "Nome do lote inválido" }, 400);

      const { data, error } = await supabase
        .from("ticket_types")
        .insert(payload)
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at");

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket_types: data || [] });
    }

    if (op === "ticketTypes.listForOrganizer") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket_types: data || [] });
    }

    if (op === "ticketTypes.create") {
      const eventId = String(params?.eventId || "").trim();
      const payload = params?.payload ?? {};
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const dataToInsert = {
        event_id: eventId,
        name: String(payload?.name || "").trim(),
        description: payload?.description ?? null,
        price: Number(payload?.price) || 0,
        quantity_available: Number(payload?.quantity_available) || 0,
        sale_start_date: payload?.sale_start_date ?? null,
        sale_end_date: payload?.sale_end_date ?? null,
        is_active: payload?.is_active ?? true,
      };

      if (!dataToInsert.name) return jsonResponse(req, { error: "Nome inválido" }, 400);

      const { data, error } = await supabase
        .from("ticket_types")
        .insert(dataToInsert)
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket_type: data });
    }

    if (op === "ticketTypes.get") {
      const ticketTypeId = String(params?.ticketTypeId || "").trim();
      if (!ticketTypeId) return jsonResponse(req, { error: "ticketTypeId inválido" }, 400);

      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, event_id, quantity_sold, sale_start_date, sale_end_date")
        .eq("id", ticketTypeId)
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket_type: data });
    }

    if (op === "ticketTypes.update") {
      const ticketTypeId = String(params?.ticketTypeId || "").trim();
      const payload = params?.payload ?? {};
      if (!ticketTypeId) return jsonResponse(req, { error: "ticketTypeId inválido" }, 400);

      const allowedKeys = new Set(["name", "description", "price", "quantity_available", "sale_start_date", "sale_end_date", "is_active"]);
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload || {})) {
        if (allowedKeys.has(key)) out[key] = value;
      }
      out.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("ticket_types")
        .update(out as any)
        .eq("id", ticketTypeId)
        .select("id, event_id, name, description, price, quantity_available, quantity_sold, is_active, sale_start_date, sale_end_date, created_at, updated_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket_type: data });
    }

    if (op === "ticketTypes.delete") {
      const ticketTypeId = String(params?.ticketTypeId || "").trim();
      if (!ticketTypeId) return jsonResponse(req, { error: "ticketTypeId inválido" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("ticket_types")
        .select("id, quantity_sold")
        .eq("id", ticketTypeId)
        .single();

      if (existingError) return jsonResponse(req, { error: existingError.message }, 400);
      if (Number((existing as any)?.quantity_sold || 0) > 0) {
        return jsonResponse(req, { error: "Nao e possivel excluir lote com ingressos vendidos." }, 400);
      }

      const { error } = await supabase.from("ticket_types").delete().eq("id", ticketTypeId);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "categories.withUpcomingCounts") {
      const now = new Date().toISOString();

      const [{ data: categories, error: categoriesError }, { data: events, error: eventsError }] = await Promise.all([
        supabase.from("categories").select("id, name, icon, description, is_active, created_at, updated_at").eq("is_active", true).order("name"),
        supabase.from("events").select("id, category_id, event_date, status").eq("status", "published").gte("event_date", now),
      ]);

      if (categoriesError) return jsonResponse(req, { error: categoriesError.message }, 400);
      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);

      const countByCategory = new Map<string, number>();
      (events || []).forEach((row: any) => {
        const categoryId = row?.category_id as string | null;
        if (!categoryId) return;
        countByCategory.set(categoryId, (countByCategory.get(categoryId) || 0) + 1);
      });

      const result = (categories || []).map((category: any) => ({
        ...category,
        upcoming_events_count: countByCategory.get(category.id) || 0,
      }));

      return jsonResponse(req, { categories: result });
    }

    if (op === "singles.listForEvent") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("event_participants")
        .select(
          "user_id, match_enabled, profiles:profiles!event_participants_user_id_fkey (id, full_name, bio, avatar_url, single_mode, match_enabled, show_initials_only, gender_identity, match_intention, match_gender_preference, sexuality, looking_for, height, relationship_status)",
        )
        .eq("event_id", eventId)
        .eq("match_enabled", true);

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const singles = (data || [])
        .map((item: any) => {
          const profile = item?.profiles;
          if (!profile) return null;

          if ((item.match_enabled ?? false) || profile.single_mode) {
            return { ...profile, match_enabled: item.match_enabled ?? false };
          }

          return {
            id: profile.id,
            full_name: "Participante",
            avatar_url: null,
            match_enabled: false,
            bio: null,
            gender_identity: null,
            match_intention: null,
            match_gender_preference: null,
            sexuality: null,
            looking_for: null,
            height: null,
            relationship_status: null,
          };
        })
        .filter(Boolean);

      return jsonResponse(req, { singles });
    }

    if (op === "tickets.listByUser") {
      const userId = String(params?.userId || "").trim() || user.id;

      const { data, error } = await supabase
        .from("event_participants")
        .select("*, event:events(*)")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { tickets: data || [] });
    }

    if (op === "tickets.getDetails") {
      const ticketId = String(params?.ticketId || "").trim();
      if (!ticketId) return jsonResponse(req, { error: "ticketId inválido" }, 400);

      const { data, error } = await supabase.from("event_participants").select("*").eq("id", ticketId).single();
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ticket: data });
    }

    if (op === "tickets.validate") {
      const ticketId = String(params?.ticketId || "").trim();
      const eventId = String(params?.eventId || "").trim();
      const token = String(params?.token || "").trim();
      if (!ticketId || !eventId || !token) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { data, error } = await supabase.rpc("validate_ticket", {
        p_ticket_id: ticketId,
        p_event_id: eventId,
        p_security_token: token,
        p_validated_by: user.id,
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { result: data });
    }

    if (op === "tickets.validateScan") {
      const code = String(params?.code || "").trim();
      const eventId = String(params?.eventId || "").trim();
      if (!code || !eventId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { data, error } = await supabase.rpc("validate_ticket_scan", {
        p_code: code,
        p_event_id: eventId,
        p_validated_by: user.id,
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { result: data });
    }

    if (op === "tickets.validateManual") {
      const code = String(params?.code || "").trim();
      const eventId = String(params?.eventId || "").trim();
      if (!code || !eventId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { data, error } = await supabase.rpc("validate_ticket_manual", {
        p_code: code,
        p_event_id: eventId,
        p_validated_by: user.id,
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { result: data });
    }

    if (op === "attendees.listForEvent") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_event_attendees", { event_uuid: eventId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { attendees: data || [] });
    }

    if (op === "matchCandidates.listForEvent") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_match_candidates", { event_uuid: eventId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { candidates: data || [] });
    }

    if (op === "profiles.getPublicProfile") {
      const profileUserId = String(params?.userId || "").trim();
      if (!profileUserId) return jsonResponse(req, { error: "userId inválido" }, 400);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, bio, avatar_url, meet_attendees, match_enabled, single_mode, show_initials_only, gender_identity, match_intention, match_gender_preference, sexuality, looking_for, height, relationship_status, birth_date, vibes, last_seen",
        )
        .eq("id", profileUserId)
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      if (!profile) return jsonResponse(req, { profile: null });

      const isVisible = (profile as any).meet_attendees || (profile as any).match_enabled || (profile as any).single_mode;
      if (!isVisible) {
        return jsonResponse(req, {
          profile: {
            id: (profile as any).id,
            name: (profile as any).full_name,
            photo: (profile as any).avatar_url,
            is_visible: false,
          },
        });
      }

      let age: number | null = null;
      const birthDate = (profile as any).birth_date as string | null;
      if (birthDate) {
        const bd = new Date(birthDate);
        if (!Number.isNaN(bd.getTime())) {
          const today = new Date();
          let years = today.getFullYear() - bd.getFullYear();
          const m = today.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) years -= 1;
          age = years;
        }
      }

      let isOnline = false;
      const lastSeen = (profile as any).last_seen as string | null;
      if (lastSeen) {
        const lastSeenDate = new Date(lastSeen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        isOnline = lastSeenDate > fiveMinutesAgo;
      }

      return jsonResponse(req, {
        profile: {
          id: (profile as any).id,
          name: (profile as any).full_name,
          photo: (profile as any).avatar_url,
          bio: (profile as any).bio,
          age,
          height: (profile as any).height,
          relationshipStatus: (profile as any).relationship_status,
          matchIntention: (profile as any).match_intention,
          genderIdentity: (profile as any).gender_identity,
          sexuality: (profile as any).sexuality,
          genderPreference: (profile as any).match_gender_preference,
          vibes: (profile as any).vibes || [],
          lookingFor: (profile as any).looking_for || [],
          lastSeen: (profile as any).last_seen,
          isOnline,
          is_visible: true,
        },
      });
    }

    if (op === "likes.has") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("event_likes")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && (error as any).code !== "PGRST116") return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { hasLiked: Boolean(data) });
    }

    if (op === "likes.toggle") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("event_likes")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError && (existingError as any).code !== "PGRST116") {
        return jsonResponse(req, { error: existingError.message }, 400);
      }

      if (existing) {
        const { error } = await supabase.from("event_likes").delete().eq("event_id", eventId).eq("user_id", user.id);
        if (error) return jsonResponse(req, { error: error.message }, 400);
        return jsonResponse(req, { liked: false });
      }

      const { error } = await supabase.from("event_likes").insert({ event_id: eventId, user_id: user.id });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { liked: true });
    }

    if (op === "events.byParticipant") {
      const userId = String(params?.userId || "").trim() || user.id;

      const { data, error } = await supabase
        .from("event_participants")
        .select(
          "event_id, event:events(id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date))",
        )
        .eq("user_id", userId);

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const rows = (data || []) as { event: EventRow | null }[];
      const events = rows
        .map((row) => row.event)
        .filter((ev): ev is EventRow => Boolean(ev))
        .map((ev) => mapEventForClient(ev));

      return jsonResponse(req, { events });
    }

    if (op === "events.byCategory") {
      const category = String(params?.category || "").trim();
      if (!category) return jsonResponse(req, { error: "Categoria inválida" }, 400);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("category", category)
        .order("event_date", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "events.byLocation") {
      const location = String(params?.location || "").trim();
      if (!location) return jsonResponse(req, { error: "Local inválido" }, 400);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .ilike("location", `%${location}%`)
        .order("event_date", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "events.trending") {
      const limit = Math.min(Number(params?.limit || 20), 50);
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, tickets_sold, views, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)",
        )
        .eq("status", "published")
        .eq("is_active", true)
        .gte("event_date", nowIso);

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const events = (data || []) as Array<EventRow & { tickets_sold?: number | null; views?: number | null }>;
      const scored = events
        .map((event) => {
          const tickets = typeof (event as any).tickets_sold === "number" ? Number((event as any).tickets_sold) : 0;
          const views = typeof (event as any).views === "number" ? Number((event as any).views) : 0;
          const score = tickets * 0.6 + views * 0.4;
          return { event: mapEventForClient(event), score };
        })
        .sort((a, b) => b.score - a.score)
        .map((item) => item.event)
        .slice(0, limit);

      return jsonResponse(req, { events: scored });
    }

    if (op === "events.organizerUpcoming") {
      const organizerId = String(params?.organizerId || "").trim() || user.id;
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled")
        .eq("creator_id", organizerId)
        .gte("event_date", today)
        .order("event_date", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      const events = (data || []).map((row) => mapEventForClient(row as EventRow));
      return jsonResponse(req, { events });
    }

    if (op === "scanLogs.list") {
      const eventId = String(params?.eventId || "").trim();
      const limit = Math.min(Number(params?.limit || 50), 200);
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase
        .from("check_in_logs")
        .select("id, event_id, ticket_id, participant_id, scanner_user_id, scan_status, scanned_at, created_at")
        .eq("event_id", eventId)
        .limit(limit);

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { logs: data || [] });
    }

    if (op === "profiles.getSelf") {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { profile: data || null });
    }

    if (op === "profiles.updateSelf") {
      const updates = params?.updates ?? {};
      const allowedKeys = new Set([
        "full_name",
        "cpf",
        "birth_date",
        "phone",
        "city",
        "avatar_url",
        "bio",
        "single_mode",
        "show_initials_only",
        "match_intention",
        "match_gender_preference",
        "gender_identity",
        "sexuality",
        "meet_attendees",
        "match_enabled",
        "looking_for",
        "height",
        "relationship_status",
        "last_seen",
        "privacy_settings",
        "allow_profile_view",
        "username",
      ]);

      const toSave: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates || {})) {
        if (allowedKeys.has(key)) toSave[key] = value;
      }
      toSave.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("profiles")
        .update(toSave as any)
        .eq("id", user.id)
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { profile: data });
    }

    if (op === "profiles.syncSignupRoles") {
      const isOrganizer = Boolean(params?.isOrganizer);
      const updates: any = {
        roles: ["BUYER", ...(isOrganizer ? ["ORGANIZER"] : [])],
        organizer_status: isOrganizer ? "PENDING" : "NONE",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "profiles.getMatchGenderPreference") {
      const { data, error } = await supabase
        .from("profiles")
        .select("match_gender_preference")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { match_gender_preference: (data as any)?.match_gender_preference ?? null });
    }

    if (op === "eventMatch.getCandidatesV2") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_event_match_candidates_v2", { p_event_id: eventId });
      if (error) return jsonResponse(req, { error: error.message, code: (error as any).code }, 400);
      return jsonResponse(req, { candidates: data || [] });
    }

    if (op === "eventMatch.getReceivedLikesV2") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_event_received_likes_v2", { p_event_id: eventId });
      if (error) return jsonResponse(req, { error: error.message, code: (error as any).code }, 400);
      return jsonResponse(req, { likes: data || [] });
    }

    if (op === "eventMatch.setOptIn") {
      const eventId = String(params?.eventId || "").trim();
      const enabled = Boolean(params?.enabled);
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("set_event_match_opt_in", {
        p_event_id: eventId,
        p_enabled: enabled,
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { result: data || {} });
    }

    if (op === "eventMatch.resetQueue") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("reset_match_queue", { p_event_id: eventId });
      if (error) {
        if ((error as any).code === "42883") {
          return jsonResponse(req, { value: null });
        }
        return jsonResponse(req, { error: error.message }, 400);
      }
      return jsonResponse(req, { value: Number(data || 0) });
    }

    if (op === "eventMatch.skipUser") {
      const eventId = String(params?.eventId || "").trim();
      const toUserId = String(params?.toUserId || "").trim();
      if (!eventId || !toUserId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { error } = await supabase.rpc("skip_match_candidate", {
        p_event_id: eventId,
        p_to_user_id: toUserId,
      });

      if (error) {
        if ((error as any).code === "42883") {
          return jsonResponse(req, { ok: false });
        }
        return jsonResponse(req, { error: error.message }, 400);
      }
      return jsonResponse(req, { ok: true });
    }

    if (op === "match.likeUser") {
      const eventId = String(params?.eventId || "").trim();
      const toUserId = String(params?.toUserId || "").trim();
      if (!eventId || !toUserId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { data, error } = await supabase.rpc("like_user", {
        p_event_id: eventId,
        p_to_user_id: toUserId,
      });

      if (error) {
        if ((error as any).code === "23505") {
          return jsonResponse(req, { status: "already_liked" });
        }
        return jsonResponse(req, { error: error.message }, 400);
      }
      return jsonResponse(req, data || {});
    }

    if (op === "match.likesSummary") {
      const { data, error } = await supabase.rpc("list_likes_summary");
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, data || { total_likes: 0, recent_likes: [] });
    }

    if (op === "match.receivedLikes") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_received_likes", { p_event_id: eventId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { likes: data || [] });
    }

    if (op === "match.ignoreLike") {
      const likeId = String(params?.likeId || "").trim();
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      if (!likeId) return jsonResponse(req, { error: "likeId inválido" }, 400);

      const payload = eventId ? { p_like_id: likeId, p_event_id: eventId } : { p_like_id: likeId };
      const { error } = await supabase.rpc("ignore_like", payload);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "match.unreadLikes") {
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      let query = supabase
        .from("likes")
        .select("id, created_at, event_id, from_user_id, status, from_user:profiles!likes_from_user_id_fkey (id, full_name, avatar_url)")
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (eventId) query = query.eq("event_id", eventId);

      const { data, error } = await query;
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { likes: data || [] });
    }

    if (op === "match.potentialMatches") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data: evaluatedData, error: evaluatedError } = await supabase
        .from("likes")
        .select("to_user_id")
        .eq("from_user_id", user.id)
        .eq("event_id", eventId);

      if (evaluatedError) return jsonResponse(req, { error: evaluatedError.message }, 400);

      const evaluatedIds = (evaluatedData || []).map((like: any) => like.to_user_id);
      evaluatedIds.push(user.id);

      const { data, error } = await supabase
        .from("event_participants")
        .select(
          "match_enabled, user:profiles!event_participants_user_id_fkey (id, full_name, avatar_url, bio, birth_date, allow_profile_view, gender_identity, match_intention, match_gender_preference, sexuality, height, relationship_status)",
        )
        .eq("event_id", eventId)
        .eq("match_enabled", true)
        .neq("status", "canceled");

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const candidates = (data || [])
        .map((item: any) => ({ ...item.user, event_match_enabled: item.match_enabled }))
        .filter((candidate: any) => candidate && !evaluatedIds.includes(candidate.id));

      return jsonResponse(req, { candidates });
    }

    if (op === "matches.list") {
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      const { data, error } = eventId
        ? await supabase.rpc("list_matches", { p_event_id: eventId })
        : await supabase.rpc("list_matches");

      if (error) return jsonResponse(req, { error: error.message, code: (error as any).code }, 400);
      return jsonResponse(req, { matches: data || [] });
    }

    if (op === "matches.getDetails") {
      const matchId = String(params?.matchId || "").trim();
      if (!matchId) return jsonResponse(req, { error: "matchId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_match_details", { p_match_id: matchId });
      if (error) return jsonResponse(req, { error: error.message, code: (error as any).code }, 400);
      return jsonResponse(req, { match: Array.isArray(data) && data.length > 0 ? data[0] : null });
    }

    if (op === "matches.listForEvent") {
      const eventId = String(params?.eventId || "").trim();
      if (!eventId) return jsonResponse(req, { error: "eventId inválido" }, 400);

      const { data, error } = await supabase.rpc("list_matches", { p_event_id: eventId });
      if (!error) return jsonResponse(req, { matches: data || [] });

      if ((error as any).code !== "42883") return jsonResponse(req, { error: error.message, code: (error as any).code }, 400);

      const { data: legacyData, error: legacyError } = await supabase.rpc("list_event_matches", { p_event_id: eventId });
      if (!legacyError) return jsonResponse(req, { matches: legacyData || [], legacy: true });

      if ((legacyError as any).code !== "42883") return jsonResponse(req, { error: legacyError.message, code: (legacyError as any).code }, 400);

      const { data: allMatches, error: allError } = await supabase.rpc("list_matches");
      if (allError) return jsonResponse(req, { error: allError.message, code: (allError as any).code }, 400);
      return jsonResponse(req, { matches: (allMatches || []).filter((match: any) => Array.isArray(match?.event_ids) && match.event_ids.includes(eventId)) });
    }

    if (op === "matches.markSeen") {
      const matchId = String(params?.matchId || "").trim();
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      if (!matchId) return jsonResponse(req, { error: "matchId inválido" }, 400);

      const payload = eventId ? { p_match_id: matchId, p_event_id: eventId } : { p_match_id: matchId };
      const { error } = await supabase.rpc("mark_match_seen", payload);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "matches.markChatOpened") {
      const matchId = String(params?.matchId || "").trim();
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      if (!matchId) return jsonResponse(req, { error: "matchId inválido" }, 400);

      const payload = eventId ? { p_match_id: matchId, p_event_id: eventId } : { p_match_id: matchId };
      const { error } = await supabase.rpc("mark_chat_opened", payload);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "notifications.list") {
      const { data, error } = await supabase.rpc("list_notifications");
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { notifications: data || [] });
    }

    if (op === "notifications.dismiss") {
      const notificationId = String(params?.id || "").trim();
      if (!notificationId) return jsonResponse(req, { error: "id inválido" }, 400);

      const { error } = await supabase.rpc("dismiss_notification", { p_notification_id: notificationId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "chat.updatePresence") {
      const chatId = params?.chatId === null ? null : String(params?.chatId || "").trim() || null;
      const { error } = await supabase.rpc("update_presence", { p_chat_id: chatId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "chat.getMessages") {
      const chatId = String(params?.chatId || "").trim();
      if (!chatId) return jsonResponse(req, { error: "chatId inválido" }, 400);

      const { data, error } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id, content, created_at, read_at, status, sender:sender_id(id, full_name, avatar_url)")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { messages: data || [] });
    }

    if (op === "chat.getOrCreate") {
      const matchId = String(params?.matchId || "").trim();
      if (!matchId) return jsonResponse(req, { error: "matchId inválido" }, 400);

      const { data, error } = await supabase.rpc("get_or_create_chat", { p_match_id: matchId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { chatId: data });
    }

    if (op === "chat.unmatchUser") {
      const matchId = String(params?.matchId || "").trim();
      if (!matchId) return jsonResponse(req, { error: "matchId inválido" }, 400);

      const { error } = await supabase.rpc("unmatch_user", { p_match_id: matchId });
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "chat.sendMessage") {
      const chatId = String(params?.chatId || "").trim();
      const content = String(params?.content || "");
      if (!chatId || !content.trim()) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const { data, error } = await supabase
        .from("messages")
        .insert({ chat_id: chatId, sender_id: user.id, content, status: "sent" })
        .select("id, chat_id, sender_id, content, created_at, read_at, status, sender:sender_id(id, full_name, avatar_url)")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { message: data });
    }

    if (op === "chat.getPresence") {
      const userId = String(params?.userId || "").trim();
      if (!userId) return jsonResponse(req, { error: "userId inválido" }, 400);

      const { data, error } = await supabase.from("user_presence").select("active_chat_id").eq("user_id", userId).maybeSingle();
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { active_chat_id: (data as any)?.active_chat_id || null });
    }

    if (op === "chat.markRead") {
      const chatId = String(params?.chatId || "").trim();
      if (!chatId) return jsonResponse(req, { error: "chatId inválido" }, 400);

      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString(), status: "seen" } as any)
        .eq("chat_id", chatId)
        .neq("sender_id", user.id)
        .neq("status", "seen");

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "likes.listByUser") {
      const userId = String(params?.userId || "").trim() || user.id;

      const { data, error } = await supabase
        .from("event_likes")
        .select(
          "event_id, event:events(id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const rows = (data || []) as { event: EventRow | null }[];
      const events = rows
        .map((row) => row.event)
        .filter((ev): ev is EventRow => Boolean(ev))
        .map((ev) => mapEventForClient(ev));

      return jsonResponse(req, { events });
    }

    if (op === "coupons.listActive") {
      const now = new Date().toISOString();
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("coupons")
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .eq("active", true)
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { coupons: data || [] });
    }

    if (op === "coupons.validate") {
      const code = String(params?.code || "").trim().toUpperCase();
      if (!code) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const now = new Date().toISOString();
      const serviceClient = getServiceRoleClient();

      const { data: coupon, error } = await serviceClient
        .from("coupons")
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .eq("code", code)
        .eq("active", true)
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      if (!coupon) return jsonResponse(req, { error: "Cupom inválido ou expirado" }, 400);

      if (coupon.max_uses && Number(coupon.current_uses || 0) >= Number(coupon.max_uses || 0)) {
        return jsonResponse(req, { error: "Cupom esgotado" }, 400);
      }

      return jsonResponse(req, { coupon });
    }

    if (op === "coupons.apply") {
      const couponId = String(params?.couponId || "").trim();
      const eventId = params?.eventId ? String(params?.eventId || "").trim() : null;
      const originalPrice = Number(params?.originalPrice || 0);
      if (!couponId || !Number.isFinite(originalPrice) || originalPrice < 0) {
        return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);
      }

      if (params?.userId && String(params.userId).trim() !== user.id) {
        return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);
      }

      const now = new Date().toISOString();
      const serviceClient = getServiceRoleClient();

      const { data: coupon, error: couponError } = await serviceClient
        .from("coupons")
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .eq("id", couponId)
        .eq("active", true)
        .lte("valid_from", now)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .maybeSingle();

      if (couponError) return jsonResponse(req, { error: couponError.message }, 400);
      if (!coupon) return jsonResponse(req, { error: "Cupom inválido ou expirado" }, 400);
      if (coupon.max_uses && Number(coupon.current_uses || 0) >= Number(coupon.max_uses || 0)) {
        return jsonResponse(req, { error: "Cupom esgotado" }, 400);
      }

      let discount = 0;
      if (coupon.discount_type === "percentage") {
        discount = (originalPrice * Number(coupon.discount_value || 0)) / 100;
      } else {
        discount = Number(coupon.discount_value || 0);
      }
      discount = Math.max(0, Math.min(discount, originalPrice));
      const finalPrice = Number((originalPrice - discount).toFixed(2));

      const { data: usage, error: usageError } = await serviceClient
        .from("coupon_usage")
        .insert({
          coupon_id: couponId,
          user_id: user.id,
          event_id: eventId || null,
          discount_applied: Number(discount.toFixed(2)),
        } as any)
        .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
        .single();

      if (usageError) return jsonResponse(req, { error: usageError.message }, 400);

      return jsonResponse(req, {
        discount: Number(discount.toFixed(2)),
        finalPrice,
        couponUsage: usage,
      });
    }

    if (op === "coupons.usage.listByUser") {
      const requestedUserId = String(params?.userId || "").trim() || user.id;

      if (requestedUserId !== user.id) {
        await requireAdmin(req, supabase, user.id);
      }

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("coupon_usage")
        .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
        .eq("user_id", requestedUserId)
        .order("used_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { usage: data || [] });
    }

    if (op === "coupons.create") {
      await requireAdmin(req, supabase, user.id);

      const couponData = params?.couponData ?? {};
      const code = String(couponData?.code || "").trim().toUpperCase();
      const discount_type = String(couponData?.discount_type || "").trim();
      const discount_value = Number(couponData?.discount_value || 0);
      const max_uses = couponData?.max_uses != null ? Number(couponData?.max_uses) : null;
      const valid_from = couponData?.valid_from ? String(couponData?.valid_from) : new Date().toISOString();
      const valid_until = couponData?.valid_until ? String(couponData?.valid_until) : null;
      const description = couponData?.description != null ? String(couponData?.description) : null;

      if (!code || (discount_type !== "percentage" && discount_type !== "fixed") || !Number.isFinite(discount_value)) {
        return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);
      }

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("coupons")
        .insert({
          code,
          description,
          discount_type,
          discount_value,
          max_uses,
          valid_from,
          valid_until,
          active: true,
          created_by: user.id,
        } as any)
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { coupon: data });
    }

    if (op === "coupons.update") {
      await requireAdmin(req, supabase, user.id);

      const couponId = String(params?.couponId || "").trim();
      const updates = params?.updates ?? {};
      if (!couponId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const allowedKeys = new Set([
        "code",
        "description",
        "discount_type",
        "discount_value",
        "max_uses",
        "valid_from",
        "valid_until",
        "active",
      ]);

      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates || {})) {
        if (!allowedKeys.has(key)) continue;
        if (key === "code") out[key] = String(value || "").trim().toUpperCase();
        else out[key] = value as any;
      }

      const normalizedOut = removeUndefined(out);
      if (Object.keys(normalizedOut).length === 0) return jsonResponse(req, { error: "Nada para atualizar" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("coupons")
        .update(normalizedOut as any)
        .eq("id", couponId)
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { coupon: data });
    }

    if (op === "coupons.delete") {
      await requireAdmin(req, supabase, user.id);
      const couponId = String(params?.couponId || "").trim();
      if (!couponId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient.from("coupons").delete().eq("id", couponId);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "coupons.listAll") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("coupons")
        .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { coupons: data || [] });
    }

    if (op === "coupons.usage.list") {
      await requireAdmin(req, supabase, user.id);

      const couponId = params?.couponId ? String(params?.couponId || "").trim() : null;
      const serviceClient = getServiceRoleClient();

      let query = serviceClient
        .from("coupon_usage")
        .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
        .order("used_at", { ascending: false });

      if (couponId) query = query.eq("coupon_id", couponId);

      const { data, error } = await query;
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { usage: data || [] });
    }

    if (op === "eventRequests.listAll") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("event_requests")
        .select("id, user_name, event_name, email, phone, city, event_location, status, notes, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { requests: data || [] });
    }

    if (op === "eventRequests.updateStatus") {
      await requireAdmin(req, supabase, user.id);
      const id = String(params?.id || "").trim();
      const status = String(params?.status || "").trim();
      const notes = params?.notes !== undefined ? String(params.notes || "") : undefined;
      if (!id || !status) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (notes !== undefined) updateData.notes = notes;

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient.from("event_requests").update(updateData).eq("id", id);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "eventRequests.delete") {
      await requireAdmin(req, supabase, user.id);
      const id = String(params?.id || "").trim();
      if (!id) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient.from("event_requests").delete().eq("id", id);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "adminSettings.get") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const [
        { data: system, error: systemError },
        { data: notifications, error: notifError },
        { data: smtp, error: smtpError },
        { data: integrations, error: intError },
      ] = await Promise.all([
        serviceClient.from("system_settings").select("*").maybeSingle(),
        serviceClient.from("notification_settings").select("*").maybeSingle(),
        serviceClient.from("smtp_settings").select("id, host, port, secure, username, from_email").maybeSingle(),
        serviceClient.from("integrations").select("*"),
      ]);

      if (systemError) return jsonResponse(req, { error: systemError.message }, 400);
      if (notifError) return jsonResponse(req, { error: notifError.message }, 400);
      if (smtpError) return jsonResponse(req, { error: smtpError.message }, 400);
      if (intError) return jsonResponse(req, { error: intError.message }, 400);

      const sanitizedIntegrations = (integrations || []).map((i: any) => ({
        id: i.id,
        provider: i.provider,
        is_enabled: i.is_enabled,
        environment: i.environment,
        public_key: i.public_key,
        wallet_id: i.wallet_id,
        split_enabled: i.split_enabled,
        platform_fee_type: i.platform_fee_type,
        platform_fee_value: i.platform_fee_value,
      }));

      return jsonResponse(req, {
        system: system || null,
        notifications: notifications || null,
        smtp: smtp || null,
        integrations: sanitizedIntegrations,
      });
    }

    if (op === "adminUsers.list") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { users: data || [] });
    }

    if (op === "adminUsers.getById") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      if (!userId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { user: data || null });
    }

    if (op === "adminUsers.getByUsername") {
      await requireAdmin(req, supabase, user.id);
      const username = String(params?.username || "").trim();
      if (!username) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .eq("username", username)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { user: data || null });
    }

    if (op === "adminUsers.pendingOrganizers") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .eq("organizer_status", "PENDING")
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { users: data || [] });
    }

    if (op === "adminUsers.updateOrganizerStatus") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      const status = String(params?.status || "").trim();
      if (!userId || !status) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient.from("profiles").update({ organizer_status: status, updated_at: new Date().toISOString() } as any).eq("id", userId);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "adminUsers.requestOrganizerAccess") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      if (!userId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data: existing, error: existingError } = await serviceClient
        .from("profiles")
        .select("roles")
        .eq("id", userId)
        .maybeSingle();

      if (existingError) return jsonResponse(req, { error: existingError.message }, 400);

      const currentRoles = Array.isArray((existing as any)?.roles) ? (existing as any).roles : ["BUYER"];
      const normalized = currentRoles.map((r: any) => String(r).toUpperCase());
      const nextRoles = normalized.includes("ORGANIZER") ? normalized : [...normalized, "ORGANIZER"];

      const { error } = await serviceClient
        .from("profiles")
        .update({ roles: nextRoles, organizer_status: "PENDING", updated_at: new Date().toISOString() } as any)
        .eq("id", userId);

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "adminUsers.update") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      const updates = params?.updates ?? {};
      if (!userId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const allowedKeys = new Set([
        "full_name",
        "bio",
        "city",
        "avatar_url",
        "roles",
        "role",
        "account_type",
        "organizer_status",
        "single_mode",
        "match_enabled",
        "show_initials_only",
        "match_intention",
        "match_gender_preference",
        "gender_identity",
        "sexuality",
        "meet_attendees",
        "looking_for",
        "height",
        "relationship_status",
        "allow_profile_view",
        "privacy_settings",
        "username",
      ]);

      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates || {})) {
        if (allowedKeys.has(key)) out[key] = value as any;
      }
      out.updated_at = new Date().toISOString();

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("profiles")
        .update(removeUndefined(out) as any)
        .eq("id", userId)
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { user: data });
    }

    if (op === "adminUsers.create") {
      await requireAdmin(req, supabase, user.id);
      const userData = params?.userData ?? {};
      const email = String(userData?.email || "").trim();
      const password = String(userData?.password || "");
      const full_name = String(userData?.full_name || "").trim();

      if (!email || !password || !full_name) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data: created, error } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      if (!created?.user?.id) return jsonResponse(req, { error: "Falha ao criar usuário" }, 400);

      const targetUserId = created.user.id;

      const updatePayload: Record<string, unknown> = {};
      if (userData?.roles) updatePayload.roles = userData.roles;
      if (userData?.role) updatePayload.role = userData.role;
      if (userData?.account_type) updatePayload.account_type = userData.account_type;
      if (userData?.organizer_status) updatePayload.organizer_status = userData.organizer_status;
      updatePayload.full_name = full_name;
      updatePayload.updated_at = new Date().toISOString();

      for (let attempt = 0; attempt < 8; attempt++) {
        const { data: existingProfile, error: profileError } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profileError) return jsonResponse(req, { error: profileError.message }, 400);

        if (existingProfile) {
          const { error: updateError } = await serviceClient.from("profiles").update(removeUndefined(updatePayload) as any).eq("id", targetUserId);
          if (updateError) return jsonResponse(req, { error: updateError.message }, 400);
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const { data: profile, error: profileFetchError } = await serviceClient
        .from("profiles")
        .select(
          "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at",
        )
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileFetchError) return jsonResponse(req, { error: profileFetchError.message }, 400);

      return jsonResponse(req, { user: created.user, profile });
    }

    if (op === "adminUsers.organizerOptions") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("profiles")
        .select("id, full_name, email, roles, organizer_status, account_type")
        .order("full_name", { ascending: true });

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const organizers = (data || [])
        .filter((profile: any) => {
          const roles = (profile.roles || []).map((role: string) => role.toUpperCase());
          const accountType = String(profile.account_type || "").toLowerCase();
          const isOrganizerRole = roles.includes("ORGANIZER");
          const isOrganizerAccountType =
            accountType === "organizador" || accountType === "comprador_organizador";
          const isApproved = (profile.organizer_status || "NONE") === "APPROVED";
          return (isOrganizerRole || isOrganizerAccountType) && isApproved;
        })
        .map((profile: any) => ({
          id: profile.id,
          full_name: profile.full_name || profile.email || "Organizador sem nome",
          email: profile.email || "",
        }));

      return jsonResponse(req, { organizers });
    }

    if (op === "adminUsers.team.getOrganizerForUser") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      if (!userId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("team_members")
        .select("organizer_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { organizerId: (data as any)?.organizer_id || null });
    }

    if (op === "adminUsers.team.upsertLink") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      const organizerId = String(params?.organizerId || "").trim();
      if (!userId || !organizerId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient
        .from("team_members")
        .upsert({ user_id: userId, organizer_id: organizerId } as any, { onConflict: "user_id" });

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "adminUsers.team.removeLink") {
      await requireAdmin(req, supabase, user.id);
      const userId = String(params?.userId || "").trim();
      if (!userId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { error } = await serviceClient.from("team_members").delete().eq("user_id", userId);
      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { ok: true });
    }

    if (op === "adminUsers.listWithStats") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const { data, error } = await serviceClient
        .from("profiles")
        .select(
          `id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at,
           event_participants!event_participants_user_id_fkey ( total_paid )`,
        )
        .order("created_at", { ascending: false });

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const users = (data || []).map((row: any) => {
        const participants = row.event_participants || [];
        const total_spent = participants.reduce((sum: number, p: any) => sum + (Number(p.total_paid) || 0), 0);
        return {
          ...row,
          total_events: participants.length,
          total_spent,
        };
      });

      return jsonResponse(req, { users });
    }

    if (op === "adminUsers.statistics") {
      await requireAdmin(req, supabase, user.id);
      const serviceClient = getServiceRoleClient();

      const [{ count: totalUsers }, { count: totalEvents }] = await Promise.all([
        serviceClient.from("profiles").select("*", { count: "exact", head: true }),
        serviceClient.from("events").select("*", { count: "exact", head: true }),
      ]);

      const { data: confirmedPayments } = await serviceClient
        .from("payments")
        .select(
          `
          value,
          created_at,
          ticket:ticket_id(
            event_id,
            unit_price,
            quantity,
            discount_amount,
            events(title)
          )
        `,
        )
        .in("status", ["paid", "received", "confirmed", "PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

      const paymentRows = confirmedPayments || [];

      const toOrganizerRevenue = (row: any) => {
        const unitPrice = Number(row?.ticket?.unit_price) || 0;
        const quantity = Number(row?.ticket?.quantity) || 1;
        const discount = Number(row?.ticket?.discount_amount) || 0;
        return Math.max(0, Number((unitPrice * quantity - discount).toFixed(2)));
      };

      const totalRevenue = paymentRows.reduce((sum: number, row: any) => {
        const organizerRevenue = toOrganizerRevenue(row);
        const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
        const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
        return sum + customerTotal;
      }, 0);

      const now = new Date();
      const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const currentMonthRevenue = paymentRows.reduce((sum: number, row: any) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        if (createdAt && createdAt >= startCurrentMonth && createdAt < startNextMonth) {
          const organizerRevenue = toOrganizerRevenue(row);
          const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
          return sum + organizerRevenue + platformFee;
        }
        return sum;
      }, 0);

      const previousMonthRevenue = paymentRows.reduce((sum: number, row: any) => {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        if (createdAt && createdAt >= startPreviousMonth && createdAt < startCurrentMonth) {
          const organizerRevenue = toOrganizerRevenue(row);
          const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
          return sum + organizerRevenue + platformFee;
        }
        return sum;
      }, 0);

      const revenueByEvent = paymentRows.reduce((acc: any, row: any) => {
        const eventId = row?.ticket?.event_id;
        if (!eventId) return acc;
        const organizerRevenue = toOrganizerRevenue(row);
        const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
        const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
        const quantity = Number(row?.ticket?.quantity) || 1;

        if (!acc[eventId]) {
          acc[eventId] = {
            event_id: eventId,
            event_title: row?.ticket?.events?.title || "Sem titulo",
            event_price: Number(row?.ticket?.unit_price) || 0,
            revenue: 0,
            organizer_revenue: 0,
            platform_revenue: 0,
            tickets_sold: 0,
          };
        }
        acc[eventId].revenue += customerTotal;
        acc[eventId].organizer_revenue += organizerRevenue;
        acc[eventId].platform_revenue += platformFee;
        acc[eventId].tickets_sold += quantity;
        return acc;
      }, {});

      const eventStats = Object.values(revenueByEvent);

      const { data: profilesCreated } = await serviceClient.from("profiles").select("created_at");

      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStartsOnMonday = (date: Date) => {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return d;
      };

      const startCurrentWeek = weekStartsOnMonday(dayStart);
      const startNextWeek = new Date(startCurrentWeek);
      startNextWeek.setDate(startCurrentWeek.getDate() + 7);
      const startPreviousWeek = new Date(startCurrentWeek);
      startPreviousWeek.setDate(startCurrentWeek.getDate() - 7);

      const currentWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
        const createdAt = profile.created_at ? new Date(profile.created_at) : null;
        if (createdAt && createdAt >= startCurrentWeek && createdAt < startNextWeek) return sum + 1;
        return sum;
      }, 0);

      const previousWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
        const createdAt = profile.created_at ? new Date(profile.created_at) : null;
        if (createdAt && createdAt >= startPreviousWeek && createdAt < startCurrentWeek) return sum + 1;
        return sum;
      }, 0);

      const organizerRevenueTotal = paymentRows.reduce((sum: number, row: any) => sum + toOrganizerRevenue(row), 0);
      const prefestRevenue = Number((totalRevenue - organizerRevenueTotal).toFixed(2));
      const profit = prefestRevenue;
      const profitMargin = totalRevenue > 0 ? (prefestRevenue / totalRevenue) * 100 : 0;

      return jsonResponse(req, {
        totalUsers: totalUsers || 0,
        totalEvents: totalEvents || 0,
        totalRevenue,
        estimatedCosts: organizerRevenueTotal,
        organizerRevenue: organizerRevenueTotal,
        prefestRevenue,
        profit,
        profitMargin,
        eventStats,
        comparison: {
          currentMonthRevenue,
          previousMonthRevenue,
          currentWeekNewUsers,
          previousWeekNewUsers,
        },
      });
    }

    if (op === "profiles.checkoutData") {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, cpf, email, phone, birth_date")
        .eq("id", user.id)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { profile: data || null });
    }

    if (op === "payments.getStatusByTicketId") {
      const ticketId = String(params?.ticketId || "").trim();
      if (!ticketId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data: ticket, error: ticketError } = await serviceClient
        .from("tickets")
        .select("id, user_id")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketError) return jsonResponse(req, { error: ticketError.message }, 400);
      if (!ticket || String((ticket as any).user_id || "") !== user.id) {
        return jsonResponse(req, { error: "Acesso negado" }, 403);
      }

      const { data: payment, error } = await serviceClient
        .from("payments")
        .select("status")
        .eq("ticket_id", ticketId)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { status: payment?.status || null });
    }

    if (op === "eventParticipants.getMatchParticipation") {
      const eventId = String(params?.eventId || "").trim();
      const targetUserId = String(params?.targetUserId || "").trim();
      if (!eventId || !targetUserId) return jsonResponse(req, { error: "Parâmetros inválidos" }, 400);

      const serviceClient = getServiceRoleClient();
      const validStatuses = ["confirmed", "paid", "valid", "used"];

      const { data: viewer, error: viewerError } = await serviceClient
        .from("event_participants")
        .select("match_enabled")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .in("status", validStatuses)
        .maybeSingle();

      if (viewerError) return jsonResponse(req, { error: viewerError.message }, 400);
      if (!viewer || !viewer.match_enabled) return jsonResponse(req, { participation: null });

      const { data, error } = await serviceClient
        .from("event_participants")
        .select("status, match_enabled")
        .eq("event_id", eventId)
        .eq("user_id", targetUserId)
        .in("status", validStatuses)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { participation: data || null });
    }

    if (op === "organizerAsaas.getAccount") {
      const organizerUserId = String(params?.organizerUserId || "").trim() || user.id;

      if (organizerUserId !== user.id) {
        await requireAdmin(req, supabase, user.id);
      }

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("organizer_asaas_accounts")
        .select("id, organizer_user_id, asaas_account_id, asaas_wallet_id, external_wallet_id, is_active, kyc_status, created_at, updated_at")
        .eq("organizer_user_id", organizerUserId)
        .maybeSingle();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { account: data || null });
    }

    if (op === "organizerAsaas.connectExternalWallet") {
      const walletId = String(params?.walletId || "").trim();
      const externalEmail = String(params?.externalEmail || "").trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(walletId);

      if (!walletId || !isUuid) return jsonResponse(req, { error: "Wallet ID inválido" }, 400);
      if (!externalEmail) return jsonResponse(req, { error: "E-mail inválido" }, 400);

      const serviceClient = getServiceRoleClient();
      const { data, error } = await serviceClient
        .from("organizer_asaas_accounts")
        .upsert(
          {
            organizer_user_id: user.id,
            asaas_account_id: walletId,
            asaas_wallet_id: walletId,
            is_active: true,
            kyc_status: "approved",
            payment_method_type: "EXTERNAL_WALLET",
            external_wallet_id: walletId,
            external_wallet_email: externalEmail,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "organizer_user_id" },
        )
        .select("id, organizer_user_id, asaas_account_id, asaas_wallet_id, external_wallet_id, is_active, kyc_status, created_at, updated_at")
        .single();

      if (error) return jsonResponse(req, { error: error.message }, 400);
      return jsonResponse(req, { account: data });
    }

    if (op === "dashboard.getSales") {
      const organizerId = String(params?.organizerId || "").trim() || user.id;
      const serviceClient = getServiceRoleClient();
      await requireOrganizerAccess(req, serviceClient, user.id, organizerId);

      const { data: events, error: eventsError } = await serviceClient
        .from("events")
        .select("id")
        .eq("creator_id", organizerId);

      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);
      if (!events || events.length === 0) return jsonResponse(req, { sales: [] });

      const eventIds = (events || []).map((e: any) => e.id);
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

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const sales = (data || []).map((item: any) => {
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
      });

      return jsonResponse(req, { sales });
    }

    if (op === "dashboard.getStats") {
      const organizerId = String(params?.organizerId || "").trim() || user.id;
      const serviceClient = getServiceRoleClient();
      await requireOrganizerAccess(req, serviceClient, user.id, organizerId);

      const { data: events, error: eventsError } = await serviceClient
        .from("events")
        .select("id, event_date")
        .eq("creator_id", organizerId);

      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);

      const totalEvents = events?.length || 0;
      const now = new Date().toISOString();
      const activeEvents = events?.filter((event: any) => event.event_date > now).length || 0;
      const eventIds = events?.map((event: any) => event.id) || [];

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

        if (participantsError) return jsonResponse(req, { error: participantsError.message }, 400);

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

        if (payError) return jsonResponse(req, { error: payError.message }, 400);

        const paymentIds = (organizerPayments || []).map((payment: any) => payment.id).filter(Boolean);
        const splitByPaymentId = new Map<string, DashboardPaymentSplitRow>();

        if (paymentIds.length > 0) {
          const { data: splitRows, error: splitError } = await serviceClient
            .from("payment_splits")
            .select("payment_id, recipient_type, fee_type, fee_value, value, status")
            .in("payment_id", paymentIds)
            .eq("recipient_type", "organizer");

          if (splitError) return jsonResponse(req, { error: splitError.message }, 400);

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
          if (payment.ticket_id && validTicketIds.size > 0 && !validTicketIds.has(payment.ticket_id)) {
            return;
          }

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
      const availableBalance = totalNet - totalWithdrawn;
      const pendingBalance = Number(pendingNet.toFixed(2));

      return jsonResponse(req, {
        totalEvents,
        activeEvents,
        totalSales,
        totalTicketsSold,
        totalRevenue: totalGross,
        totalGrossRevenue: totalGross,
        totalNetRevenue: totalNet,
        totalPlatformFees,
        availableBalance,
        pendingBalance,
        totalWithdrawn,
        monthlyComparison: {
          currentMonthRevenue: Number(currentMonthRevenue.toFixed(2)),
          previousMonthRevenue: Number(previousMonthRevenue.toFixed(2)),
          currentMonthTickets,
          previousMonthTickets,
          currentMonthParticipants,
          previousMonthParticipants,
        },
      });
    }

    if (op === "dashboard.getFinancialTransactions") {
      const organizerId = String(params?.organizerId || "").trim() || user.id;
      const serviceClient = getServiceRoleClient();
      await requireOrganizerAccess(req, serviceClient, user.id, organizerId);

      const { data: events, error: eventsError } = await serviceClient
        .from("events")
        .select("id")
        .eq("creator_id", organizerId);

      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);
      const eventIds = events?.map((event: any) => event.id) || [];
      if (eventIds.length === 0) return jsonResponse(req, { transactions: [] });

      const { data: participants, error: participantsError } = await serviceClient
        .from("event_participants")
        .select("ticket_id, ticket_quantity, total_paid, joined_at, user:profiles!event_participants_user_id_fkey(full_name, email)")
        .in("event_id", eventIds);

      if (participantsError) return jsonResponse(req, { error: participantsError.message }, 400);

      const participantByTicketId = new Map<
        string,
        { ticketQuantity: number; totalPaid: number; joinedAt: string | null; buyerName: string; buyerEmail: string }
      >();

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

      if (paymentsError) return jsonResponse(req, { error: paymentsError.message }, 400);

      const paymentIds = (payments || []).map((payment: any) => payment.id).filter(Boolean);
      const splitByPaymentId = new Map<string, DashboardPaymentSplitRow>();

      if (paymentIds.length > 0) {
        const { data: splitRows, error: splitError } = await serviceClient
          .from("payment_splits")
          .select("payment_id, recipient_type, fee_type, fee_value, value, status")
          .in("payment_id", paymentIds)
          .eq("recipient_type", "organizer");

        if (splitError) return jsonResponse(req, { error: splitError.message }, 400);

        (splitRows || []).forEach((row: any) => {
          if (row?.payment_id && !splitByPaymentId.has(row.payment_id)) {
            splitByPaymentId.set(row.payment_id, row);
          }
        });
      }

      const transactions = (payments || [])
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
        .filter((payment: any) => payment.grossAmount > 0);

      return jsonResponse(req, { transactions });
    }

    if (op === "dashboard.getSalesChart") {
      const organizerId = String(params?.organizerId || "").trim() || user.id;
      const period = String(params?.period || "week");
      const serviceClient = getServiceRoleClient();
      await requireOrganizerAccess(req, serviceClient, user.id, organizerId);

      const { data: events, error: eventsError } = await serviceClient
        .from("events")
        .select("id")
        .eq("creator_id", organizerId);

      if (eventsError) return jsonResponse(req, { error: eventsError.message }, 400);
      if (!events || events.length === 0) return jsonResponse(req, { chart: [] });

      const eventIds = (events || []).map((e: any) => e.id);
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

      if (error) return jsonResponse(req, { error: error.message }, 400);

      const salesMap = new Map<string, { amount: number; count: number }>();
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(nowDate.getDate() - i);
        const key = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

      const chart = Array.from(salesMap.entries())
        .map(([date, data]) => ({ date, amount: data.amount, count: data.count }))
        .reverse();

      return jsonResponse(req, { chart });
    }

    return jsonResponse(req, { error: "Operação não suportada" }, 400);
  } catch (error: any) {
    const thrown = await responseFromThrownError(req, error);
    if (thrown) return thrown;
    return new Response(JSON.stringify({ error: error?.message || "Erro interno" }), {
      status: 500,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
});
