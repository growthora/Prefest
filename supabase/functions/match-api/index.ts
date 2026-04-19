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

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "match-api");

    if (req.method === "POST" && segments[0] === "like") {
      return withMiddleware(
        req,
        { action: "match_like_user", rateLimit: { endpoint: "match-like", maxRequests: 30, windowSeconds: 60 } },
        async ({ supabase }) => {
          const body = await parseJsonBody<{ eventId?: string; toUserId?: string }>(req);
          const eventId = String(body.eventId || "").trim();
          const toUserId = String(body.toUserId || "").trim();
          assertCondition(eventId && toUserId, "INVALID_PARAMS", "Parametros invalidos", 400);

          const { data, error } = await supabase!.rpc("like_user", {
            p_event_id: eventId,
            p_to_user_id: toUserId,
          });

          if (error) {
            if ((error as any).code === "23505") return { status: "already_liked" };
            throw new HttpError("MATCH_LIKE_FAILED", error.message, 400);
          }

          return data || {};
        },
      );
    }

    if (req.method === "POST" && segments[0] === "dislike") {
      return withMiddleware(
        req,
        { action: "match_dislike_user", rateLimit: { endpoint: "match-dislike", maxRequests: 30, windowSeconds: 60 } },
        async ({ supabase }) => {
          const body = await parseJsonBody<{ likeId?: string; eventId?: string }>(req);
          const likeId = String(body.likeId || "").trim();
          const eventId = body.eventId ? String(body.eventId || "").trim() : null;
          assertCondition(likeId, "INVALID_LIKE_ID", "likeId invalido", 400);

          const payload = eventId ? { p_like_id: likeId, p_event_id: eventId } : { p_like_id: likeId };
          const { error } = await supabase!.rpc("ignore_like", payload);
          if (error) throw new HttpError("MATCH_DISLIKE_FAILED", error.message, 400);
          return { ok: true };
        },
      );
    }

    if (req.method === "GET" && segments[0] === "list") {
      return withMiddleware(req, { action: "matches_list" }, async ({ supabase }) => {
        const eventId = getQueryParam(req, "eventId");
        const { data, error } = await supabase!.rpc("list_matches", { p_event_id: eventId || null });
        if (error) throw new HttpError("MATCHES_LIST_FAILED", error.message, 400);
        return { matches: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "details" && segments[1]) {
      return withMiddleware(req, { action: "matches_get_details" }, async ({ supabase }) => {
        const matchId = String(segments[1] || "").trim();
        const { data, error } = await supabase!.rpc("get_match_details", { p_match_id: matchId });
        if (error) throw new HttpError("MATCH_DETAILS_FETCH_FAILED", error.message, 400);
        return { match: Array.isArray(data) && data.length > 0 ? data[0] : null };
      });
    }

    if (req.method === "GET" && segments[0] === "event" && segments[1] && segments[2] === "list") {
      return withMiddleware(req, { action: "matches_list_for_event" }, async ({ supabase }) => {
        const eventId = String(segments[1] || "").trim();
        const { data, error } = await supabase!.rpc("list_matches", { p_event_id: eventId });
        if (!error) return { matches: data || [] };
        if ((error as any).code !== "42883") {
          throw new HttpError("MATCHES_LIST_FOR_EVENT_FAILED", error.message, 400);
        }

        const { data: legacyData, error: legacyError } = await supabase!.rpc("list_event_matches", { p_event_id: eventId });
        if (!legacyError) return { matches: legacyData || [], legacy: true };
        if ((legacyError as any).code !== "42883") {
          throw new HttpError("MATCHES_LIST_FOR_EVENT_FAILED", legacyError.message, 400);
        }

        const { data: allMatches, error: allError } = await supabase!.rpc("list_matches", { p_event_id: null });
        if (allError) throw new HttpError("MATCHES_LIST_FOR_EVENT_FAILED", allError.message, 400);
        return { matches: (allMatches || []).filter((match: any) => Array.isArray(match?.event_ids) && match.event_ids.includes(eventId)) };
      });
    }

    if (req.method === "POST" && segments[0] === "seen") {
      return withMiddleware(req, { action: "matches_mark_seen" }, async ({ supabase }) => {
        const body = await parseJsonBody<{ matchId?: string; eventId?: string }>(req);
        const matchId = String(body.matchId || "").trim();
        const eventId = body.eventId ? String(body.eventId).trim() : null;
        assertCondition(matchId, "INVALID_MATCH_ID", "matchId invalido", 400);
        const payload = eventId ? { p_match_id: matchId, p_event_id: eventId } : { p_match_id: matchId };
        const { error } = await supabase!.rpc("mark_match_seen", payload);
        if (error) throw new HttpError("MATCH_MARK_SEEN_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "POST" && segments[0] === "chat-opened") {
      return withMiddleware(req, { action: "matches_mark_chat_opened" }, async ({ supabase }) => {
        const body = await parseJsonBody<{ matchId?: string; eventId?: string }>(req);
        const matchId = String(body.matchId || "").trim();
        const eventId = body.eventId ? String(body.eventId).trim() : null;
        assertCondition(matchId, "INVALID_MATCH_ID", "matchId invalido", 400);
        const payload = eventId ? { p_match_id: matchId, p_event_id: eventId } : { p_match_id: matchId };
        const { error } = await supabase!.rpc("mark_chat_opened", payload);
        if (error) throw new HttpError("MATCH_MARK_CHAT_OPENED_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "likes" && segments[1] === "summary") {
      return withMiddleware(req, { action: "match_likes_summary" }, async ({ supabase }) => {
        const { data, error } = await supabase!.rpc("list_likes_summary");
        if (error) throw new HttpError("LIKES_SUMMARY_FETCH_FAILED", error.message, 400);
        return data || { total_likes: 0, recent_likes: [] };
      });
    }

    if (req.method === "GET" && segments[0] === "likes" && segments[1] === "received") {
      return withMiddleware(req, { action: "match_received_likes" }, async ({ supabase }) => {
        const eventId = String(getQueryParam(req, "eventId") || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);
        const { data, error } = await supabase!.rpc("get_received_likes", { p_event_id: eventId });
        if (error) throw new HttpError("RECEIVED_LIKES_FETCH_FAILED", error.message, 400);
        return { likes: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "likes" && segments[1] === "unread") {
      return withMiddleware(req, { action: "match_unread_likes" }, async ({ user, supabase }) => {
        const eventId = getQueryParam(req, "eventId");
        let query = supabase!
          .from("likes")
          .select("id, created_at, event_id, from_user_id, status, from_user:profiles!likes_from_user_id_fkey (id, full_name, avatar_url)")
          .eq("to_user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (eventId) query = query.eq("event_id", eventId);
        const { data, error } = await query;
        if (error) throw new HttpError("UNREAD_LIKES_FETCH_FAILED", error.message, 400);
        return { likes: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "potential") {
      return withMiddleware(req, { action: "match_potential_matches" }, async ({ user, supabase }) => {
        const eventId = String(getQueryParam(req, "eventId") || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);

        const { data: evaluatedData, error: evaluatedError } = await supabase!
          .from("likes")
          .select("to_user_id")
          .eq("from_user_id", user!.id)
          .eq("event_id", eventId);

        if (evaluatedError) throw new HttpError("POTENTIAL_MATCHES_FETCH_FAILED", evaluatedError.message, 400);

        const evaluatedIds = (evaluatedData || []).map((like: any) => like.to_user_id);
        evaluatedIds.push(user!.id);

        const { data, error } = await supabase!
          .from("event_participants")
          .select(
            "user:profiles!event_participants_user_id_fkey (id, full_name, avatar_url, bio, birth_date, allow_profile_view, gender_identity, match_intention, match_gender_preference, sexuality, height, relationship_status, match_enabled)",
          )
          .eq("event_id", eventId)
          .neq("status", "canceled");

        if (error) throw new HttpError("POTENTIAL_MATCHES_FETCH_FAILED", error.message, 400);

        return {
          candidates: (data || [])
            .map((item: any) => ({ ...item.user, event_match_enabled: item.user?.match_enabled ?? false }))
            .filter((candidate: any) => candidate?.event_match_enabled)
            .filter((candidate: any) => candidate && !evaluatedIds.includes(candidate.id)),
        };
      });
    }

    if (req.method === "GET" && segments[0] === "candidates") {
      return withMiddleware(req, { action: "event_match_candidates" }, async ({ supabase }) => {
        const eventId = String(getQueryParam(req, "eventId") || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);
        const { data, error } = await supabase!.rpc("get_event_match_candidates_v2", { p_event_id: eventId });
        if (error) throw new HttpError("MATCH_CANDIDATES_FETCH_FAILED", error.message, 400);
        return { candidates: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "event-likes") {
      return withMiddleware(req, { action: "event_match_received_likes_v2" }, async ({ supabase }) => {
        const eventId = String(getQueryParam(req, "eventId") || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);
        const { data, error } = await supabase!.rpc("get_event_received_likes_v2", { p_event_id: eventId });
        if (error) throw new HttpError("EVENT_RECEIVED_LIKES_FETCH_FAILED", error.message, 400);
        return { likes: data || [] };
      });
    }

    if (req.method === "POST" && segments[0] === "opt-in") {
      return withMiddleware(
        req,
        { action: "event_match_opt_in", rateLimit: { endpoint: "event-match-opt-in", maxRequests: 30, windowSeconds: 60 } },
        async ({ supabase }) => {
          const body = await parseJsonBody<{ eventId?: string; enabled?: boolean }>(req);
          const eventId = String(body.eventId || "").trim();
          const enabled = Boolean(body.enabled);
          assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);

          const { data, error } = await supabase!.rpc("set_event_match_opt_in", {
            p_event_id: eventId,
            p_enabled: enabled,
          });
          if (error) throw new HttpError("MATCH_OPT_IN_FAILED", error.message, 400);
          return { result: data || {} };
        },
      );
    }

    if (req.method === "POST" && segments[0] === "reset-queue") {
      return withMiddleware(req, { action: "event_match_reset_queue" }, async ({ supabase }) => {
        const body = await parseJsonBody<{ eventId?: string }>(req);
        const eventId = String(body.eventId || "").trim();
        assertCondition(eventId, "INVALID_EVENT_ID", "eventId invalido", 400);

        const { data, error } = await supabase!.rpc("reset_match_queue", { p_event_id: eventId });
        if (error) {
          if ((error as any).code === "42883") return { value: null };
          throw new HttpError("MATCH_RESET_QUEUE_FAILED", error.message, 400);
        }
        return { value: Number(data || 0) };
      });
    }

    if (req.method === "POST" && segments[0] === "skip") {
      return withMiddleware(req, { action: "event_match_skip_user" }, async ({ supabase }) => {
        const body = await parseJsonBody<{ eventId?: string; toUserId?: string }>(req);
        const eventId = String(body.eventId || "").trim();
        const toUserId = String(body.toUserId || "").trim();
        assertCondition(eventId && toUserId, "INVALID_PARAMS", "Parametros invalidos", 400);

        const { error } = await supabase!.rpc("skip_match_candidate", {
          p_event_id: eventId,
          p_to_user_id: toUserId,
        });

        if (error) {
          if ((error as any).code === "42883") return { ok: false };
          throw new HttpError("MATCH_SKIP_FAILED", error.message, 400);
        }
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "notifications") {
      return withMiddleware(req, { action: "notifications_list" }, async ({ supabase }) => {
        const { data, error } = await supabase!.rpc("list_notifications");
        if (error) throw new HttpError("NOTIFICATIONS_FETCH_FAILED", error.message, 400);
        return { notifications: data || [] };
      });
    }

    if (req.method === "DELETE" && segments[0] === "notifications" && segments[1]) {
      return withMiddleware(req, { action: "notifications_dismiss" }, async ({ supabase }) => {
        const notificationId = String(segments[1] || "").trim();
        const { error } = await supabase!.rpc("dismiss_notification", { p_notification_id: notificationId });
        if (error) throw new HttpError("NOTIFICATION_DISMISS_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
