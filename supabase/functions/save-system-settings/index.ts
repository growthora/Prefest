import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { requireRole } from '../_shared/requireRole.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Authenticate User
    const { user, supabase: supabaseClient } = await requireAuth(req);

    // 2. Authorize Admin
    await requireRole(supabaseClient, user.id, ['ADMIN']);

    // 3. Setup Service Role Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        throw new Error('Server misconfiguration: Missing Supabase keys');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Parse Body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ 
            ok: false, 
            error: 'Invalid JSON body' 
        }), {
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    const { system, notifications, smtp, integrations } = body;

    console.log('Saving settings for user:', user.id);

    // 5. Call RPC to save settings (using Service Role to bypass RLS for system tables if needed, 
    // though the RPC checks is_admin internally too)
    const { error: rpcError } = await adminClient.rpc('save_admin_settings', {
      p_system: system,
      p_notifications: notifications,
      p_smtp: smtp,
      p_integrations: integrations
    });

    if (rpcError) {
        console.error('RPC Error save_admin_settings:', rpcError);
        return new Response(JSON.stringify({ 
            ok: false,
            error: `Database Error: ${rpcError.message}`,
            detail: rpcError
        }), {
            status: 400, // Bad Request if DB rejects it
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ 
        ok: true,
        success: true 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Handle explicitly thrown Responses (like from requireAuth)
    if (error instanceof Response) return error;

    console.error('Function Error save-system-settings:', error);
    return new Response(JSON.stringify({ 
        ok: false,
        error: `Internal Error: ${error.message || 'Unknown error'}`,
        detail: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
