import { getCorsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)
  const url = new URL(req.url)

  return new Response(JSON.stringify({
    ok: true,
    function: "mcp",
    project: "wuqztevrdctctwmetjzn",
    path: url.pathname,
    method: req.method,
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: corsHeaders,
  })
})
