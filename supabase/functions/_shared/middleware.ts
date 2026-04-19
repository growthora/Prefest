import {
  createClient,
  SupabaseClient,
  User,
} from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "./cors.ts";
import { errorResponse, HttpError, successResponse } from "./http.ts";
import { enforceRateLimit, RateLimitOptions } from "./rateLimit.ts";

export interface RequestContext {
  req: Request;
  user: User | null;
  supabase: SupabaseClient | null;
  serviceClient: SupabaseClient;
  requestId: string;
  ip: string | null;
  startedAt: number;
}

interface HandlerOptions {
  action: string;
  requireAuth?: boolean;
  roles?: string[];
  rateLimit?: Omit<RateLimitOptions, "userId" | "ip">;
}

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function createServiceRoleClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function createAnonClient(authHeader?: string | null) {
  const headers = authHeader ? { Authorization: authHeader } : {};
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY"),
    { global: { headers } },
  );
}

export function getRequestIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip");
}

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError("UNAUTHORIZED", "Token de autenticacao ausente", 401);
  }

  const supabase = createAnonClient(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new HttpError("UNAUTHORIZED", "Token invalido ou expirado", 401);
  }

  return { user: data.user, supabase };
}

export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  allowedRoles: string[],
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError("ROLE_LOOKUP_FAILED", error.message, 500);
  }

  const singularRole = String(data?.role || "").toUpperCase();
  const roles = Array.isArray(data?.roles)
    ? data.roles.map((role: unknown) => String(role).toUpperCase())
    : [];
  const normalizedAllowed = allowedRoles.map((role) => role.toUpperCase());

  if (!normalizedAllowed.includes(singularRole) && !normalizedAllowed.some((role) => roles.includes(role))) {
    throw new HttpError("FORBIDDEN", "Acesso negado", 403);
  }
}

function logStructured(input: Record<string, unknown>) {
  console.log(JSON.stringify(input));
}

export async function withMiddleware(
  req: Request,
  options: HandlerOptions,
  handler: (ctx: RequestContext) => Promise<unknown>,
) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const ip = getRequestIp(req);
  const serviceClient = createServiceRoleClient();

  try {
    let user: User | null = null;
    let supabase: SupabaseClient | null = null;

    if (options.requireAuth !== false) {
      const auth = await requireAuth(req);
      user = auth.user;
      supabase = auth.supabase;
    }

    if (options.roles?.length && user && supabase) {
      await requireRole(supabase, user.id, options.roles);
    }

    if (options.rateLimit) {
      await enforceRateLimit(serviceClient, {
        ...options.rateLimit,
        userId: user?.id || null,
        ip,
      });
    }

    const data = await handler({
      req,
      user,
      supabase,
      serviceClient,
      requestId,
      ip,
      startedAt,
    });

    logStructured({
      action: options.action,
      requestId,
      userId: user?.id || null,
      status: "success",
      duration: Date.now() - startedAt,
      method: req.method,
      path: new URL(req.url).pathname,
    });

    return successResponse(req, data);
  } catch (error) {
    const normalized =
      error instanceof HttpError
        ? error
        : new HttpError("INTERNAL_ERROR", error instanceof Error ? error.message : "Erro interno", 500);

    logStructured({
      action: options.action,
      requestId,
      status: "error",
      code: normalized.code,
      message: normalized.message,
      duration: Date.now() - startedAt,
      method: req.method,
      path: new URL(req.url).pathname,
    });

    return errorResponse(req, normalized);
  }
}
