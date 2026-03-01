import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    // Debug info to return in case of error
    const debugInfo = {
        hasAuthHeader: !!authHeader,
        authHeaderPrefix: authHeader ? authHeader.substring(0, 15) + '...' : 'none',
        supabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        supabaseAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
    };

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(JSON.stringify({ 
          ok: false,
          error: 'Missing Authorization header',
          debug: debugInfo
      }), {
        status: 200, // Return 200 so frontend can parse JSON
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Create client with user's token to verify auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
        console.error('Auth Error:', userError);
        return new Response(JSON.stringify({ 
            ok: false,
            error: `Unauthorized: ${userError?.message || 'Invalid Token'}`,
            debug: { ...debugInfo, authError: userError }
        }), {
            status: 200, // Return 200 so frontend can parse JSON
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Use Service Role for Admin Check and RPC execution to ensure reliability
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single();

    // Check if user is admin (role column OR roles array)
    const isAdmin = profile?.role === 'admin' || (Array.isArray(profile?.roles) && profile.roles.includes('admin'));

    if (!isAdmin) {
      console.error('Forbidden: User is not admin', user.id);
      return new Response(JSON.stringify({ 
          ok: false,
          error: 'Forbidden: Admins only',
          debug: { userId: user.id, role: profile?.role }
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return new Response(JSON.stringify({ 
            ok: false, 
            error: 'Invalid JSON body' 
        }), {
            status: 200, 
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
