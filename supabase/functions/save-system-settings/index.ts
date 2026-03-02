import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/requireAuth.ts';
import { requireRole } from '../_shared/requireRole.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: supabaseClient } = await requireAuth(req);

    // Check if user is admin (roles array only)
    await requireRole(supabaseClient, user.id, ['ADMIN']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Use Service Role for sensitive operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

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

    // Call RPC using Service Role
    // Note: ensure save_admin_settings RPC exists and accepts these parameters
    const { error: rpcError } = await adminClient.rpc('save_admin_settings', {
      p_system: system,
      p_notifications: notifications,
      p_smtp: smtp,
      p_integrations: integrations
    });

    if (rpcError) {
        console.error('RPC Error:', rpcError);
        return new Response(JSON.stringify({ 
            ok: false,
            error: `Database Error: ${rpcError.message}`,
            detail: rpcError
        }), {
            status: 200,
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
    console.error('Function Error:', error);
    return new Response(JSON.stringify({ 
        ok: false,
        error: `Internal Error: ${error.message}`,
        detail: String(error)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
