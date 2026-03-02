import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "https://esm.sh/nodemailer@6.9.13";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { requireRole } from '../_shared/requireRole.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: supabaseClient } = await requireAuth(req);

    // Admin check
    await requireRole(supabaseClient, user.id, ['ADMIN']);

    const { host, port, user: smtpUser, pass, secure, from_email, test_email } = await req.json();

    // If password is not provided, fetch from DB using RPC
    let password = pass;
    if (!password) {
        const { data: dbPass, error: dbError } = await supabaseClient.rpc('get_decrypted_smtp_password');
        if (dbError) throw dbError;
        password = dbPass;
    }

    if (!password) {
        throw new Error('Password required (either provided or stored)');
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: secure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: password,
      },
    });

    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: from_email,
      to: test_email || from_email, // Send to self if no test email provided
      subject: 'Teste de Configuração SMTP - Prefest',
      text: 'Se você recebeu este e-mail, as configurações SMTP estão corretas!',
      html: '<b>Se você recebeu este e-mail, as configurações SMTP estão corretas!</b>',
    });

    return new Response(JSON.stringify({ success: true, message: 'Conexão SMTP verificada e e-mail de teste enviado!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SMTP Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
