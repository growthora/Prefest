import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

interface UptimeRequest {
  scope?: "prefest" | "readonly" | "main";
  monitor_ids?: string[];
  logs?: number;
  response_times?: number;
  response_times_limit?: number;
}

function resolveApiKey(scope: UptimeRequest["scope"]): string {
  const prefest = Deno.env.get("UPTIMEROBOT_API_KEY_PREFEST2026") ?? "";
  const readonly = Deno.env.get("UPTIMEROBOT_READONLY_API_KEY") ?? "";
  const main = Deno.env.get("UPTIMEROBOT_MAIN_API_KEY") ?? "";

  if (scope === "main") return main;
  if (scope === "readonly") return readonly;
  return prefest || readonly || main;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = (await req.json().catch(() => ({}))) as UptimeRequest;
    const apiKey = resolveApiKey(body.scope ?? "prefest");

    if (!apiKey) {
      throw new Error("Missing UPTIMEROBOT API key secret");
    }

    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("format", "json");
    params.set("logs", String(body.logs ?? 1));
    params.set("response_times", String(body.response_times ?? 1));
    params.set("response_times_limit", String(body.response_times_limit ?? 10));
    params.set("all_time_uptime_ratio", "1");

    if (body.monitor_ids?.length) {
      params.set("monitors", body.monitor_ids.join(","));
    }

    const uptimeRes = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await uptimeRes.json();

    if (!uptimeRes.ok || data?.stat !== "ok") {
      const message =
        data?.error?.message ||
        data?.message ||
        `UptimeRobot request failed with status ${uptimeRes.status}`;
      throw new Error(message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        monitors: data?.monitors ?? [],
        pagination: data?.pagination ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  }
});

