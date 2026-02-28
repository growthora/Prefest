import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "https://esm.sh/nodemailer@6.9.13";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Admin check
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || (Array.isArray(profile?.roles) && profile.roles.includes('admin'));

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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
