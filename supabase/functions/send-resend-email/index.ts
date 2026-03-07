import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { requireRole } from "../_shared/requireRole.ts";

interface SendEmailPayload {
  from?: string;
  to?: string | string[];
  subject?: string;
  html?: string;
  text?: string;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase } = await requireAuth(req);
    await requireRole(supabase, user.id, ["ADMIN"]);

    const { from, to, subject, html, text } = (await req.json()) as SendEmailPayload;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    if (!from || !to || !subject || (!html && !text)) {
      throw new Error("Invalid payload: from, to, subject and html/text are required");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = (data as { message?: string })?.message ?? "Failed to send email via Resend";
      throw new Error(message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully via Resend",
        id: (data as { id?: string })?.id,
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
