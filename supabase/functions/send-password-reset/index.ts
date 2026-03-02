import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "https://esm.sh/nodemailer@6.9.13";

// Inline CORS helpers to avoid deployment dependency issues
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, idempotency-key, x-application-name, x-client-version, asaas-access-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
};

const getCorsHeaders = (req: Request) => {
  return CORS_HEADERS;
};

const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Use Service Role to access SMTP settings and generate link
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get SMTP Password (Decrypted)
    const { data: dbPass, error: dbError } = await supabaseAdmin.rpc('get_decrypted_smtp_password');
    if (dbError) throw new Error('Failed to retrieve SMTP password');
    
    // 2. Get SMTP Settings
    const { data: settings, error: settingsError } = await supabaseAdmin
        .from('smtp_settings')
        .select('*')
        .single();
    
    if (settingsError || !settings) {
        throw new Error('SMTP Settings not configured in Admin Dashboard');
    }

    if (!settings.host || !settings.username) {
        throw new Error('SMTP Host/User not configured in Admin Dashboard');
    }

    // 3. Generate Recovery Link
    const origin = req.headers.get('origin') || 'https://prefrest-frontend.vercel.app';
    const redirectTo = `${origin}/update-password`;

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
            redirectTo
        }
    });

    if (linkError) {
        console.error('Generate Link Error:', linkError);
        throw linkError; 
    }

    const actionLink = linkData.properties?.action_link;
    
    if (!actionLink) {
         throw new Error('Failed to generate action link');
    }

    // 4. Send Email
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: Number(settings.port) || 587,
      secure: settings.secure, 
      auth: {
        user: settings.username,
        pass: dbPass,
      },
    });

    await transporter.verify();

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Recuperação de Senha</h2>
        <p>Olá,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <a href="${actionLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Redefinir Senha</a>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">Se você não solicitou isso, ignore este e-mail.</p>
      </div>
    `;

    await transporter.sendMail({
      from: settings.from_email || settings.username,
      to: email,
      subject: 'Recuperação de Senha - Prefest',
      html: html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Password Reset Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
