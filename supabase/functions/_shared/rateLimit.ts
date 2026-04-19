import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

export interface RateLimitOptions {
  endpoint: string;
  userId?: string | null;
  ip?: string | null;
  maxRequests: number;
  windowSeconds: number;
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit(
  serviceClient: SupabaseClient,
  options: RateLimitOptions,
) {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStartedAt = new Date(windowStartMs).toISOString();
  const userId = options.userId || null;
  const ip = options.ip || "unknown";
  const key = await sha256(`${options.endpoint}:${userId || "anonymous"}:${ip}:${windowStartMs}`);

  const { data: existing, error: readError } = await serviceClient
    .from("edge_rate_limits")
    .select("request_count")
    .eq("key", key)
    .maybeSingle();

  if (readError) {
    throw new HttpError("RATE_LIMIT_READ_ERROR", "Falha ao validar limite de requisicoes", 500);
  }

  const nextCount = Number(existing?.request_count || 0) + 1;
  if (nextCount > options.maxRequests) {
    throw new HttpError("RATE_LIMITED", "Limite de requisicoes excedido. Tente novamente em instantes.", 429);
  }

  const { error: writeError } = await serviceClient.from("edge_rate_limits").upsert({
    key,
    endpoint: options.endpoint,
    user_id: userId,
    ip,
    window_started_at: windowStartedAt,
    request_count: nextCount,
    updated_at: new Date(now).toISOString(),
  } as never);

  if (writeError) {
    throw new HttpError("RATE_LIMIT_WRITE_ERROR", "Falha ao registrar limite de requisicoes", 500);
  }
}
