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

type EventImageRow = {
  id: string;
  event_id: string;
  image_url: string;
  is_cover: boolean | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

const EVENT_SELECT =
  "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled, ticket_types(id, price, quantity_available, quantity_sold, is_active, is_test, is_internal, is_hidden, sale_start_date, sale_end_date)";

const EVENT_SELECT_SIMPLE =
  "id, slug, title, description, event_date, end_at, location, state, city, event_type, image_url, category, category_id, status, price, is_paid_event, max_participants, current_participants, is_active, sales_enabled";

const SOLD_PAYMENT_STATUSES = new Set([
  "PAID",
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
]);

function calculateEventDisplayPrice(tickets: TicketTypeRow[]) {
  const now = new Date();

  const activeTickets = (tickets || []).filter((ticket) => {
    const isVisible = (ticket.is_active ?? true) && !ticket.is_test && !ticket.is_internal && !ticket.is_hidden;
    const hasInventory = Number(ticket.quantity_available || 0) > Number(ticket.quantity_sold || 0);
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

async function resolveManagedOrganizerId(supabase: any, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("roles, role")
    .eq("id", userId)
    .single();

  if (profileError) throw new HttpError("PROFILE_FETCH_FAILED", profileError.message, 400);

  const roles = ((profile as any)?.roles || []).map((role: string) => String(role).toUpperCase());
  const isEquipeOnly = roles.includes("EQUIPE") && !roles.includes("ORGANIZER") && !roles.includes("ADMIN");

  if (!isEquipeOnly) {
    return userId;
  }

  const { data: teamRow, error: teamError } = await supabase
    .from("team_members")
    .select("organizer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (teamError) throw new HttpError("TEAM_MEMBER_FETCH_FAILED", teamError.message, 400);
  return String((teamRow as any)?.organizer_id || userId);
}

async function fetchEventsByCreator(supabase: any, creatorId: string) {
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(EVENT_SELECT_SIMPLE)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (eventsError) throw new HttpError("EVENTS_FETCH_FAILED", eventsError.message, 400);
  if (!events || events.length === 0) return [];

  const eventIds = (events || []).map((event: any) => event.id);
  const [{ data: participants }, { data: ticketTypes }] = await Promise.all([
    supabase
      .from("event_participants")
      .select("event_id, ticket_quantity, total_paid, ticket:ticket_id(unit_price, quantity, discount_amount), status")
      .in("event_id", eventIds as never)
      .in("status", ["valid", "used", "paid", "confirmed"]),
    supabase
      .from("ticket_types")
      .select("event_id, quantity_available")
      .in("event_id", eventIds as never),
  ]);

  const revenueMap = new Map<string, number>();
  const ticketsMap = new Map<string, number>();
  const capacityMap = new Map<string, number>();

  (participants || []).forEach((participant: any) => {
    const ticket = participant.ticket as { unit_price?: number | null; quantity?: number | null; discount_amount?: number | null } | null;
    let organizerAmount = 0;
    if (ticket && typeof ticket.unit_price === "number") {
      const qty = Number(participant.ticket_quantity) || Number(ticket.quantity) || 1;
      const discount = Number(ticket.discount_amount) || 0;
      const gross = Math.max(0, Number((Number(ticket.unit_price) * qty - discount).toFixed(2)));
      organizerAmount = Number((gross * 0.9).toFixed(2));
    } else {
      const paid = Number(participant.total_paid) || 0;
      const gross = paid > 0 ? Number((paid / 1.1).toFixed(2)) : 0;
      organizerAmount = gross > 0 ? Number((gross * 0.9).toFixed(2)) : 0;
    }

    revenueMap.set(participant.event_id, (revenueMap.get(participant.event_id) || 0) + organizerAmount);
    ticketsMap.set(participant.event_id, (ticketsMap.get(participant.event_id) || 0) + (Number(participant.ticket_quantity) || 0));
  });

  (ticketTypes || []).forEach((ticketType: any) => {
    capacityMap.set(ticketType.event_id, (capacityMap.get(ticketType.event_id) || 0) + (Number(ticketType.quantity_available) || 0));
  });

  return (events || []).map((event: any) => ({
    ...mapEventForClient(event as EventRow),
    revenue: revenueMap.get(event.id) || 0,
    ticketsSold: ticketsMap.get(event.id) || 0,
    totalTicketsConfigured: capacityMap.get(event.id) || 0,
  }));
}

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "event-api");

    if (req.method === "GET" && segments.length === 1 && segments[0] === "categories") {
      return withMiddleware(req, { action: "event_categories_list" }, async ({ supabase }) => {
        const { data, error } = await supabase!
          .from("categories")
          .select("id, name, slug, icon, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw new HttpError("CATEGORIES_FETCH_FAILED", error.message, 400);
        return { categories: data || [] };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0] === "upcoming-categories") {
      return withMiddleware(req, { action: "event_categories_upcoming_counts", requireAuth: false }, async ({ serviceClient }) => {
        const now = new Date().toISOString();
        const [{ data: categories, error: categoriesError }, { data: events, error: eventsError }] = await Promise.all([
          serviceClient.from("categories").select("id, name, slug, icon, is_active, created_at").eq("is_active", true).order("name"),
          serviceClient.from("events").select("id, category_id, event_date, status, is_active").eq("status", "published").eq("is_active", true).gte("event_date", now),
        ]);

        if (categoriesError) throw new HttpError("CATEGORIES_FETCH_FAILED", categoriesError.message, 400);
        if (eventsError) throw new HttpError("EVENTS_FETCH_FAILED", eventsError.message, 400);

        const countByCategory = new Map<string, number>();
        (events || []).forEach((row: any) => {
          const categoryId = row?.category_id as string | null;
          if (!categoryId) return;
          countByCategory.set(categoryId, (countByCategory.get(categoryId) || 0) + 1);
        });

        return {
          categories: (categories || []).map((category: any) => ({
            ...category,
            upcoming_events_count: countByCategory.get(category.id) || 0,
          })),
        };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0] === "public") {
      return withMiddleware(req, { action: "event_public_list", requireAuth: false }, async ({ serviceClient }) => {
        const { data, error } = await serviceClient
          .from("events")
          .select(EVENT_SELECT)
          .eq("status", "published")
          .eq("is_active", true)
          .order("event_date", { ascending: true });

        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "GET" && segments[0] === "public" && segments[1] === "slug" && segments[2]) {
      return withMiddleware(req, { action: "event_public_get_by_slug", requireAuth: false }, async ({ serviceClient }) => {
        const slug = String(segments[2] || "").trim();
        const { data, error } = await serviceClient
          .from("events")
          .select(EVENT_SELECT)
          .eq("slug", slug)
          .eq("status", "published")
          .eq("is_active", true)
          .maybeSingle();

        if (error) throw new HttpError("EVENT_FETCH_FAILED", error.message, 400);
        if (!data) throw new HttpError("EVENT_NOT_FOUND", "Evento nao encontrado", 404);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "GET" && segments[0] === "public" && segments[1] && segments[2] !== "images") {
      return withMiddleware(req, { action: "event_public_get_by_id", requireAuth: false }, async ({ serviceClient }) => {
        const eventId = String(segments[1] || "").trim();
        const { data, error } = await serviceClient
          .from("events")
          .select(EVENT_SELECT)
          .eq("id", eventId)
          .eq("status", "published")
          .eq("is_active", true)
          .maybeSingle();

        if (error) throw new HttpError("EVENT_FETCH_FAILED", error.message, 400);
        if (!data) throw new HttpError("EVENT_NOT_FOUND", "Evento nao encontrado", 404);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0] === "trending") {
      return withMiddleware(req, { action: "event_trending", requireAuth: false }, async ({ serviceClient }) => {
        const limit = Math.min(Number(getQueryParam(req, "limit") || 20), 50);
        const nowIso = new Date().toISOString();

        const { data, error } = await serviceClient
          .from("events")
          .select(EVENT_SELECT)
          .eq("status", "published")
          .eq("is_active", true)
          .gte("event_date", nowIso);

        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);

        const scored = ((data || []) as Array<EventRow & { ticket_types?: Array<{ quantity_sold?: number | null }> }>)
          .map((event) => {
            const tickets = Array.isArray((event as any).ticket_types)
              ? (event as any).ticket_types.reduce((acc: number, ticket: any) => acc + Number(ticket?.quantity_sold || 0), 0)
              : 0;
            const participants = Number((event as any).current_participants || 0);
            const score = tickets * 0.7 + participants * 0.3;
            return { event: mapEventForClient(event), score };
          })
          .sort((a, b) => b.score - a.score)
          .map((item) => item.event)
          .slice(0, limit);

        return { events: scored };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0] === "new") {
      return withMiddleware(req, { action: "event_new_list", requireAuth: false }, async ({ serviceClient }) => {
        const now = new Date();
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const { data, error } = await serviceClient
          .from("events")
          .select(`${EVENT_SELECT}, created_at`)
          .eq("status", "published")
          .eq("is_active", true)
          .gte("event_date", now.toISOString())
          .gte("created_at", fourteenDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "GET" && segments[0] === "category" && segments[1]) {
      return withMiddleware(req, { action: "event_by_category" }, async ({ supabase }) => {
        const category = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("events")
          .select(EVENT_SELECT)
          .eq("category", category)
          .order("event_date", { ascending: true });
        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "GET" && segments.length === 1 && segments[0] === "location") {
      return withMiddleware(req, { action: "event_by_location" }, async ({ supabase }) => {
        const location = String(getQueryParam(req, "q") || "").trim();
        assertCondition(location, "INVALID_LOCATION", "Local invalido", 400);
        const { data, error } = await supabase!
          .from("events")
          .select(EVENT_SELECT)
          .ilike("location", `%${location}%`)
          .order("event_date", { ascending: true });
        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "GET" && segments[0] === "organizer" && segments[1] === "managed-id") {
      return withMiddleware(req, { action: "event_managed_organizer_id" }, async ({ user, supabase }) => {
        return { organizerId: await resolveManagedOrganizerId(supabase, user!.id) };
      });
    }

    if (req.method === "GET" && segments[0] === "organizer" && segments[2] === "events") {
      return withMiddleware(req, { action: "event_by_creator" }, async ({ user, supabase }) => {
        const creatorId = String(segments[1] || "").trim() || user!.id;
        return { events: await fetchEventsByCreator(supabase, creatorId) };
      });
    }

    if (req.method === "GET" && segments[0] === "organizer" && segments[2] === "upcoming") {
      return withMiddleware(req, { action: "event_organizer_upcoming" }, async ({ user, supabase }) => {
        const organizerId = String(segments[1] || "").trim() || user!.id;
        const today = new Date().toISOString().split("T")[0];
        const { data, error } = await supabase!
          .from("events")
          .select(EVENT_SELECT_SIMPLE)
          .eq("creator_id", organizerId)
          .gte("event_date", today)
          .order("event_date", { ascending: true });
        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "GET" && segments[0] === "participant" && segments[1]) {
      return withMiddleware(req, { action: "event_by_participant" }, async ({ supabase }) => {
        const userId = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("event_participants")
          .select(`event_id, event:events(${EVENT_SELECT})`)
          .eq("user_id", userId);
        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        const rows = (data || []) as { event: EventRow | null }[];
        return {
          events: rows
            .map((row) => row.event)
            .filter((event): event is EventRow => Boolean(event))
            .map((event) => mapEventForClient(event)),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "likes" && segments[1] === "user" && segments[2]) {
      return withMiddleware(req, { action: "event_likes_by_user" }, async ({ supabase }) => {
        const userId = String(segments[2] || "").trim();
        const { data, error } = await supabase!
          .from("event_likes")
          .select(`event_id, event:events(${EVENT_SELECT})`)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw new HttpError("EVENT_LIKES_FETCH_FAILED", error.message, 400);
        const rows = (data || []) as { event: EventRow | null }[];
        return {
          events: rows
            .map((row) => row.event)
            .filter((event): event is EventRow => Boolean(event))
            .map((event) => mapEventForClient(event)),
        };
      });
    }

    if (req.method === "POST" && segments[0] === "likes" && segments[1] && segments[2] === "toggle") {
      return withMiddleware(req, { action: "event_toggle_like" }, async ({ user, supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const { data: existing, error: existingError } = await supabase!
          .from("event_likes")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (existingError && (existingError as any).code !== "PGRST116") {
          throw new HttpError("EVENT_LIKE_LOOKUP_FAILED", existingError.message, 400);
        }

        if (existing) {
          const { error } = await supabase!.from("event_likes").delete().eq("event_id", eventId).eq("user_id", user!.id);
          if (error) throw new HttpError("EVENT_UNLIKE_FAILED", error.message, 400);
          return { liked: false };
        }

        const { error } = await supabase!.from("event_likes").insert({ event_id: eventId, user_id: user!.id } as never);
        if (error) throw new HttpError("EVENT_LIKE_FAILED", error.message, 400);
        return { liked: true };
      });
    }

    if (req.method === "GET" && segments[0] === "likes" && segments[1] && segments[2] === "status") {
      return withMiddleware(req, { action: "event_has_like" }, async ({ user, supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("event_likes")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (error && (error as any).code !== "PGRST116") throw new HttpError("EVENT_LIKE_LOOKUP_FAILED", error.message, 400);
        return { hasLiked: Boolean(data) };
      });
    }

    if (req.method === "POST" && segments.length === 1 && segments[0] === "requests") {
      return withMiddleware(req, { action: "event_request_create", requireAuth: false }, async ({ serviceClient }) => {
        const body = await parseJsonBody<{ user_name?: string; event_name?: string; email?: string; phone?: string; city?: string; event_location?: string }>(req);
        const user_name = String(body.user_name || "").trim();
        const event_name = String(body.event_name || "").trim();
        const email = String(body.email || "").trim();
        const phone = String(body.phone || "").trim();
        const city = String(body.city || "").trim();
        const event_location = String(body.event_location || "").trim();

        assertCondition(user_name && event_name && email && phone && city && event_location, "INVALID_PARAMS", "Parametros invalidos", 400);

        const { data, error } = await serviceClient
          .from("event_requests")
          .insert({ user_name, event_name, email, phone, city, event_location, status: "pending" } as never)
          .select("id, user_name, event_name, email, phone, city, event_location, status, notes, created_at, updated_at")
          .single();

        if (error) throw new HttpError("EVENT_REQUEST_CREATE_FAILED", error.message, 400);
        return { request: data };
      });
    }

    if (req.method === "GET" && segments.length === 0) {
      return withMiddleware(req, { action: "event_list_all" }, async ({ supabase }) => {
        const includeDrafts = getQueryParam(req, "includeDrafts") === "true";
        const includeInactive = getQueryParam(req, "includeInactive") === "true";
        let query = supabase!.from("events").select(EVENT_SELECT).order("event_date", { ascending: true });

        if (!includeDrafts) query = query.eq("status", "published");
        if (!includeInactive) query = query.eq("is_active", true);

        const { data, error } = await query;
        if (error) throw new HttpError("EVENTS_FETCH_FAILED", error.message, 400);
        return { events: (data || []).map((row) => mapEventForClient(row as EventRow)) };
      });
    }

    if (req.method === "POST" && segments.length === 0) {
      return withMiddleware(req, { action: "event_create" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ eventData?: Record<string, any> }>(req);
        const eventData = body.eventData ?? {};
        const title = String(eventData.title || "").trim();
        assertCondition(title, "INVALID_TITLE", "Titulo e obrigatorio", 400);

        let slug = generateSlug(title);
        const { count, error: countError } = await supabase!
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("slug", slug);

        if (countError) throw new HttpError("EVENT_SLUG_LOOKUP_FAILED", countError.message, 400);
        if (count && count > 0) {
          slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
        }

        const eventToInsert = {
          ...eventData,
          slug,
          creator_id: user!.id,
          category_id: eventData.category_id || null,
          category: eventData.category || null,
          image_url: eventData.image_url || null,
          max_participants: eventData.max_participants || null,
          is_paid_event: eventData.is_paid_event ?? false,
          sales_enabled: eventData.sales_enabled ?? false,
          asaas_required: eventData.asaas_required ?? true,
          is_active: true,
        };

        const { data, error } = await supabase!
          .from("events")
          .insert(eventToInsert as never)
          .select(EVENT_SELECT_SIMPLE)
          .single();

        if (error) throw new HttpError("EVENT_CREATE_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "GET" && segments.length === 1) {
      return withMiddleware(req, { action: "event_get_by_id" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!.from("events").select(EVENT_SELECT).eq("id", eventId).single();
        if (error) throw new HttpError("EVENT_FETCH_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "PUT" && segments.length === 1) {
      return withMiddleware(req, { action: "event_update" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const body = await parseJsonBody<{ updates?: Record<string, unknown> }>(req);
        const updates = pickEventUpdateFields(body.updates);
        const { data, error } = await supabase!
          .from("events")
          .update(updates as never)
          .eq("id", eventId)
          .select(EVENT_SELECT_SIMPLE)
          .single();
        if (error) throw new HttpError("EVENT_UPDATE_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "DELETE" && segments.length === 1) {
      return withMiddleware(req, { action: "event_delete" }, async ({ user, supabase, serviceClient }) => {
        const eventId = String(segments[0] || "").trim();
        const { data: event, error: eventError } = await serviceClient.from("events").select("id, creator_id").eq("id", eventId).single();
        if (eventError || !event) throw new HttpError("EVENT_NOT_FOUND", "Evento nao encontrado", 404);

        const { data: requesterProfile } = await supabase!.from("profiles").select("roles, role").eq("id", user!.id).single();
        const roles = (requesterProfile?.roles || []).map((role: string) => String(role).toUpperCase());
        const isAdmin = roles.includes("ADMIN") || String(requesterProfile?.role || "").toLowerCase() === "admin";
        const isOwner = (event as any).creator_id === user!.id;
        if (!isAdmin && !isOwner) throw new HttpError("FORBIDDEN", "Acesso negado", 403);

        const { data: tickets, error: ticketsError } = await serviceClient.from("tickets").select("id").eq("event_id", eventId);
        if (ticketsError) throw new HttpError("EVENT_TICKETS_FETCH_FAILED", ticketsError.message, 400);

        const ticketIds = (tickets || []).map((ticket: any) => ticket.id);
        if (ticketIds.length > 0) {
          const { data: payments, error: paymentsError } = await serviceClient.from("payments").select("id, status").in("ticket_id", ticketIds as never);
          if (paymentsError) throw new HttpError("EVENT_PAYMENTS_FETCH_FAILED", paymentsError.message, 400);

          const hasSoldTickets = (payments || []).some((payment: any) => SOLD_PAYMENT_STATUSES.has(String(payment.status || "").toUpperCase()));
          if (hasSoldTickets) {
            throw new HttpError(
              "EVENT_HAS_SOLD_TICKETS",
              "Nao e possivel excluir este evento porque ja houve ingressos vendidos. Use desativar para deixar o evento totalmente offline.",
              400,
            );
          }

          const paymentIds = (payments || []).map((payment: any) => payment.id);
          if (paymentIds.length > 0) {
            const { error: splitDeleteError } = await serviceClient.from("payment_splits").delete().in("payment_id", paymentIds as never);
            if (splitDeleteError) throw new HttpError("EVENT_PAYMENT_SPLITS_DELETE_FAILED", splitDeleteError.message, 400);

            const { error: paymentsDeleteError } = await serviceClient.from("payments").delete().in("id", paymentIds as never);
            if (paymentsDeleteError) throw new HttpError("EVENT_PAYMENTS_DELETE_FAILED", paymentsDeleteError.message, 400);
          }

          const { error: ticketsDeleteError } = await serviceClient.from("tickets").delete().eq("event_id", eventId);
          if (ticketsDeleteError) throw new HttpError("EVENT_TICKETS_DELETE_FAILED", ticketsDeleteError.message, 400);
        }

        await serviceClient.from("event_participants").delete().eq("event_id", eventId);
        await serviceClient.from("check_in_logs").delete().eq("event_id", eventId);
        await serviceClient.from("event_likes").delete().eq("event_id", eventId);

        const { error: deleteEventError } = await serviceClient.from("events").delete().eq("id", eventId);
        if (deleteEventError) throw new HttpError("EVENT_DELETE_FAILED", deleteEventError.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "slug" && segments[1]) {
      return withMiddleware(req, { action: "event_get_by_slug" }, async ({ supabase }) => {
        const slug = String(segments[1] || "").trim();
        const { data, error } = await supabase!
          .from("events")
          .select(EVENT_SELECT)
          .eq("slug", slug)
          .eq("status", "published")
          .eq("is_active", true)
          .single();
        if (error) throw new HttpError("EVENT_FETCH_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "POST" && segments[1] === "deactivate") {
      return withMiddleware(req, { action: "event_deactivate" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!
          .from("events")
          .update({
            is_active: false,
            sales_enabled: false,
            status: "draft",
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", eventId)
          .select(EVENT_SELECT_SIMPLE)
          .single();
        if (error) throw new HttpError("EVENT_DEACTIVATE_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "POST" && segments[1] === "reactivate") {
      return withMiddleware(req, { action: "event_reactivate" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!
          .from("events")
          .update({
            is_active: true,
            status: "published",
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", eventId)
          .select(EVENT_SELECT_SIMPLE)
          .single();
        if (error) throw new HttpError("EVENT_REACTIVATE_FAILED", error.message, 400);
        return { event: mapEventForClient(data as EventRow) };
      });
    }

    if (req.method === "GET" && segments[1] === "images") {
      return withMiddleware(req, { action: "event_images_list" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!
          .from("event_images")
          .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
          .eq("event_id", eventId)
          .order("display_order", { ascending: true });
        if (error) throw new HttpError("EVENT_IMAGES_FETCH_FAILED", error.message, 400);
        return { images: (data || []) as EventImageRow[] };
      });
    }

    if (req.method === "GET" && segments[0] === "public" && segments[2] === "images") {
      return withMiddleware(req, { action: "event_public_images_list", requireAuth: false }, async ({ serviceClient }) => {
        const eventId = String(segments[1] || "").trim();
        const { data: eventRow, error: eventError } = await serviceClient
          .from("events")
          .select("status, is_active")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError) throw new HttpError("EVENT_FETCH_FAILED", eventError.message, 400);
        if (!eventRow || (eventRow as any).is_active !== true || (eventRow as any).status !== "published") {
          return { images: [] };
        }

        const { data, error } = await serviceClient
          .from("event_images")
          .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
          .eq("event_id", eventId)
          .order("display_order", { ascending: true });
        if (error) throw new HttpError("EVENT_IMAGES_FETCH_FAILED", error.message, 400);
        return { images: (data || []) as EventImageRow[] };
      });
    }

    if (req.method === "PUT" && segments[1] === "images") {
      return withMiddleware(req, { action: "event_images_set" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const body = await parseJsonBody<{ images?: any[] }>(req);
        const images = Array.isArray(body.images) ? body.images : [];
        assertCondition(eventId && images.length > 0, "INVALID_PARAMS", "Imagens invalidas", 400);

        const normalized = images
          .filter((img: any) => typeof img?.image_url === "string" && img.image_url.trim().length > 0)
          .map((img: any, index: number) => ({
            event_id: eventId,
            image_url: String(img.image_url).trim(),
            is_cover: Boolean(img.is_cover),
            display_order: Number.isFinite(Number(img.display_order)) ? Number(img.display_order) : index,
          }))
          .slice(0, 5);

        assertCondition(normalized.length > 0, "INVALID_IMAGES", "Imagens invalidas", 400);

        const coverIndex = normalized.findIndex((img: any) => img.is_cover);
        const withCover = normalized.map((img: any, index: number) => ({
          ...img,
          is_cover: coverIndex >= 0 ? index === coverIndex : index === 0,
          display_order: index,
        }));

        const cover = withCover.find((img: any) => img.is_cover) || withCover[0];
        const payloadToInsert = withCover.sort((a: any, b: any) => Number(b.is_cover) - Number(a.is_cover));

        const { error: deleteError } = await supabase!.from("event_images").delete().eq("event_id", eventId);
        if (deleteError) throw new HttpError("EVENT_IMAGES_DELETE_FAILED", deleteError.message, 400);

        const { data: inserted, error: insertError } = await supabase!
          .from("event_images")
          .insert(payloadToInsert as never)
          .select("id, event_id, image_url, is_cover, display_order, created_at, updated_at")
          .order("display_order", { ascending: true });

        if (insertError) throw new HttpError("EVENT_IMAGES_INSERT_FAILED", insertError.message, 400);

        const { error: eventUpdateError } = await supabase!
          .from("events")
          .update({ image_url: cover.image_url, updated_at: new Date().toISOString() } as never)
          .eq("id", eventId);
        if (eventUpdateError) throw new HttpError("EVENT_COVER_UPDATE_FAILED", eventUpdateError.message, 400);

        return { images: (inserted || []) as EventImageRow[] };
      });
    }

    if (req.method === "GET" && segments[1] === "participants") {
      return withMiddleware(req, { action: "event_participants_list" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const limit = Math.min(Number(getQueryParam(req, "limit") || 100), 500);
        const { data, error } = await supabase!
          .from("event_participants")
          .select(
            `
            id,
            status,
            user:profiles!event_participants_user_id_fkey!inner(
              id,
              full_name,
              avatar_url,
              match_enabled
            )
          `,
          )
          .eq("event_id", eventId)
          .limit(limit);

        if (error) throw new HttpError("EVENT_PARTICIPANTS_FETCH_FAILED", error.message, 400);
        return {
          participants: (data || []).map((participant: any) => ({
            id: participant.id,
            userId: participant.user.id,
            name: participant.user.full_name || "Usuario",
            avatar_url: participant.user.avatar_url,
            status: participant.status,
            match_enabled: participant.user.match_enabled ?? false,
          })),
        };
      });
    }

    if (req.method === "GET" && segments[1] === "singles") {
      return withMiddleware(req, { action: "event_singles_list" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!
          .from("event_participants")
          .select(
            "user_id, profiles:profiles!event_participants_user_id_fkey (id, full_name, bio, avatar_url, single_mode, match_enabled, show_initials_only, gender_identity, match_intention, match_gender_preference, sexuality, looking_for, height, relationship_status)",
          )
          .eq("event_id", eventId);
        if (error) throw new HttpError("EVENT_SINGLES_FETCH_FAILED", error.message, 400);

        return {
          singles: (data || [])
            .map((item: any) => {
              const profile = item?.profiles;
              if (!profile) return null;
              if ((profile.match_enabled ?? false) || profile.single_mode) {
                return { ...profile, match_enabled: profile.match_enabled ?? false };
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
            .filter(Boolean),
        };
      });
    }

    if (req.method === "GET" && segments[1] === "match-candidates") {
      return withMiddleware(req, { action: "event_match_candidates_legacy" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!.rpc("get_match_candidates", { event_uuid: eventId });
        if (error) throw new HttpError("EVENT_MATCH_CANDIDATES_FETCH_FAILED", error.message, 400);
        return { candidates: data || [] };
      });
    }

    if (req.method === "GET" && segments[1] === "attendees") {
      return withMiddleware(req, { action: "event_attendees_list" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const { data, error } = await supabase!.rpc("get_event_attendees", { event_uuid: eventId });
        if (error) throw new HttpError("EVENT_ATTENDEES_FETCH_FAILED", error.message, 400);
        return { attendees: data || [] };
      });
    }

    if (req.method === "GET" && segments[1] === "scan-logs") {
      return withMiddleware(req, { action: "event_scan_logs_list" }, async ({ supabase }) => {
        const eventId = String(segments[0] || "").trim();
        const limit = Math.min(Number(getQueryParam(req, "limit") || 50), 200);
        const { data, error } = await supabase!
          .from("check_in_logs")
          .select("id, event_id, ticket_id, participant_id, scanner_user_id, scan_status, scanned_at, created_at")
          .eq("event_id", eventId)
          .limit(limit);
        if (error) throw new HttpError("EVENT_SCAN_LOGS_FETCH_FAILED", error.message, 400);
        return { logs: data || [] };
      });
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
