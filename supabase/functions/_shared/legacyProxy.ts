import { HttpError } from "./http.ts";

interface LegacyProxyOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function callLegacyFunction(
  req: Request,
  functionPath: string,
  options: LegacyProxyOptions = {},
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !anonKey) {
    throw new HttpError("LEGACY_PROXY_CONFIG_ERROR", "Ambiente do proxy legado incompleto", 500);
  }

  const headers: Record<string, string> = {
    apikey: anonKey,
    ...(options.headers || {}),
  };

  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    headers.Authorization = authHeader;
  } else if (!headers.Authorization) {
    headers.Authorization = `Bearer ${anonKey}`;
  }

  const method = (options.method || "POST").toUpperCase();
  const fetchOptions: RequestInit = { method, headers };

  if (options.body !== undefined && method !== "GET") {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    fetchOptions.body =
      typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionPath}`, fetchOptions);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && ((payload as any).error || (payload as any).message)) ||
      (typeof payload === "string" && payload.trim()) ||
      `Legacy function error (${response.status})`;

    throw new HttpError("LEGACY_PROXY_ERROR", String(message), response.status || 500, payload);
  }

  return payload;
}
