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

    const segments = getRouteSegments(req, "chat-api");

    if (req.method === "GET" && segments[0] === "messages") {
      return withMiddleware(req, { action: "chat_get_messages" }, async ({ supabase }) => {
        const chatId = String(getQueryParam(req, "chatId") || "").trim();
        assertCondition(chatId, "INVALID_CHAT_ID", "chatId invalido", 400);

        const { data, error } = await supabase!
          .from("messages")
          .select("id, chat_id, sender_id, content, created_at, read_at, status, sender:sender_id(id, full_name, avatar_url)")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true });

        if (error) throw new HttpError("CHAT_MESSAGES_FETCH_FAILED", error.message, 400);
        return { messages: data || [] };
      });
    }

    if (req.method === "POST" && segments[0] === "send") {
      return withMiddleware(
        req,
        { action: "chat_send_message", rateLimit: { endpoint: "chat-send", maxRequests: 30, windowSeconds: 60 } },
        async ({ user, supabase }) => {
          const body = await parseJsonBody<{ chatId?: string; content?: string }>(req);
          const chatId = String(body.chatId || "").trim();
          const content = String(body.content || "").trim();
          assertCondition(chatId && content, "INVALID_PARAMS", "Parametros invalidos", 400);

          const { data, error } = await supabase!
            .from("messages")
            .insert({ chat_id: chatId, sender_id: user!.id, content, status: "sent" } as never)
            .select("id, chat_id, sender_id, content, created_at, read_at, status, sender:sender_id(id, full_name, avatar_url)")
            .single();

          if (error) throw new HttpError("CHAT_SEND_FAILED", error.message, 400);
          return { message: data };
        },
      );
    }

    if (req.method === "POST" && segments[0] === "presence") {
      return withMiddleware(req, { action: "chat_update_presence" }, async ({ supabase }) => {
        const body = await parseJsonBody<{ chatId?: string | null }>(req);
        const chatId = body.chatId === null ? null : String(body.chatId || "").trim() || null;
        const { error } = await supabase!.rpc("update_presence", { p_chat_id: chatId });
        if (error) throw new HttpError("CHAT_PRESENCE_UPDATE_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "GET" && segments[0] === "presence" && segments[1]) {
      return withMiddleware(req, { action: "chat_get_presence" }, async ({ supabase }) => {
        const targetUserId = String(segments[1] || "").trim();
        const { data, error } = await supabase!.from("user_presence").select("active_chat_id").eq("user_id", targetUserId).maybeSingle();
        if (error) throw new HttpError("CHAT_PRESENCE_FETCH_FAILED", error.message, 400);
        return { active_chat_id: data?.active_chat_id || null };
      });
    }

    if (req.method === "POST" && segments[0] === "match" && segments[1]) {
      return withMiddleware(req, { action: "chat_get_or_create" }, async ({ supabase }) => {
        const matchId = String(segments[1] || "").trim();
        const { data, error } = await supabase!.rpc("get_or_create_chat", { p_match_id: matchId });
        if (error) throw new HttpError("CHAT_GET_OR_CREATE_FAILED", error.message, 400);
        return { chatId: data };
      });
    }

    if (req.method === "DELETE" && segments[0] === "match" && segments[1]) {
      return withMiddleware(req, { action: "chat_unmatch_user" }, async ({ supabase }) => {
        const matchId = String(segments[1] || "").trim();
        const { error } = await supabase!.rpc("unmatch_user", { p_match_id: matchId });
        if (error) throw new HttpError("CHAT_UNMATCH_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    if (req.method === "POST" && segments[0] === "read") {
      return withMiddleware(req, { action: "chat_mark_read" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ chatId?: string }>(req);
        const chatId = String(body.chatId || "").trim();
        assertCondition(chatId, "INVALID_CHAT_ID", "chatId invalido", 400);

        const { error } = await supabase!
          .from("messages")
          .update({ read_at: new Date().toISOString(), status: "seen" } as never)
          .eq("chat_id", chatId)
          .neq("sender_id", user!.id)
          .neq("status", "seen");

        if (error) throw new HttpError("CHAT_MARK_READ_FAILED", error.message, 400);
        return { ok: true };
      });
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
