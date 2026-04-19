import { getCorsHeaders } from "./cors.ts";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function successResponse(req: Request, data: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      error: null,
    }),
    {
      status,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

export function errorResponse(req: Request, error: unknown) {
  const normalized = normalizeError(error);
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: {
        code: normalized.code,
        message: normalized.message,
      },
    }),
    {
      status: normalized.status,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json; charset=utf-8",
      },
    },
  );
}

export function normalizeError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  if (error instanceof Response) {
    return new HttpError(
      "HTTP_ERROR",
      error.statusText || "Erro na requisicao",
      error.status || 500,
    );
  }

  const message = error instanceof Error ? error.message : "Erro interno";
  return new HttpError("INTERNAL_ERROR", message, 500);
}

export async function parseJsonBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  const raw = await req.text();
  if (!raw.trim()) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError("INVALID_JSON", "JSON invalido", 400);
  }
}

export function getRouteSegments(req: Request, functionSlug: string): string[] {
  const pathname = new URL(req.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const functionIndex = parts.findIndex((part) => part === functionSlug);
  if (functionIndex === -1) return [];
  return parts.slice(functionIndex + 1);
}

export function getQueryParam(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

export function assertMethod(req: Request, allowed: string[]) {
  if (!allowed.includes(req.method.toUpperCase())) {
    throw new HttpError("METHOD_NOT_ALLOWED", "Metodo nao permitido", 405);
  }
}

export function assertCondition(condition: unknown, code: string, message: string, status = 400) {
  if (!condition) throw new HttpError(code, message, status);
}
