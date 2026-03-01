
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    // Determine organizer ID.
    // If the caller is an admin (service role), they might pass an organizer_user_id in the body.
    // But typically this is called by the organizer themselves.
    // Let's stick to the organizer calling it for themselves for now.
    const organizerId = user.id
    
    // Retrieve Asaas Account ID
    const { data: accountData, error: accountError } = await adminClient
        .from('organizer_asaas_accounts')
        .select('*')
        .eq('organizer_user_id', organizerId)
        .single()

    if (accountError || !accountData) {
        return new Response(JSON.stringify({ error: 'Asaas account not found for this organizer' }), { status: 404, headers: corsHeaders })
    }

    const { data: config, error: configError } = await adminClient.rpc('get_decrypted_asaas_config')
    
    if (configError || !config || !config.api_key) {
        return new Response(JSON.stringify({ error: 'Asaas configuration error' }), { status: 500, headers: corsHeaders })
    }

    const API_URL = config.environment === 'production' 
        ? 'https://api.asaas.com/v3' 
        : 'https://sandbox.asaas.com/api/v3'

    // Fetch account status from Asaas
    // We use the main API key to fetch the subaccount details using its ID
    const response = await fetch(`${API_URL}/accounts/${accountData.asaas_account_id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'access_token': config.api_key
        }
    })

    const data = await response.json()
    
    if (!response.ok) {
        console.error('Asaas API Error:', data);
        return new Response(JSON.stringify({ error: 'Error fetching account from Asaas', details: data }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Determine status
    // Asaas statuses: PENDING, APPROVED, REJECTED, AWAITING_APPROVAL
    // We map them to our enums: 'pending', 'approved', 'rejected', 'awaiting_approval'
    // is_active = true ONLY if status === 'APPROVED' (or equivalent)
    
    // data.status is usually upper case.
    // We map generic statuses to our specific ones if needed.
    let kycStatus = 'pending'
    if (data.status) {
        kycStatus = data.status.toLowerCase()
    }
    
    // Ensure the status is one of the allowed values in DB check constraint
    // CHECK (kyc_status IN ('pending', 'approved', 'rejected', 'awaiting_approval'))
    // If Asaas returns something else, default to 'pending' or handle it.
    const allowedStatuses = ['pending', 'approved', 'rejected', 'awaiting_approval']
    if (!allowedStatuses.includes(kycStatus)) {
        // Map unknown statuses
        if (kycStatus === 'denied') kycStatus = 'rejected'
        else if (kycStatus === 'awaiting_documents') kycStatus = 'awaiting_approval'
        else kycStatus = 'pending' 
    }

    const isActive = kycStatus === 'approved'

    // Update DB
    const { data: updatedAccount, error: updateError } = await adminClient
        .from('organizer_asaas_accounts')
        .update({
            kyc_status: kycStatus,
            is_active: isActive,
            updated_at: new Date().toISOString()
        })
        .eq('id', accountData.id)
        .select()
        .single()

    if (updateError) {
        console.error('DB Update Error:', updateError);
        return new Response(JSON.stringify({ error: 'Error updating account status in database', details: updateError }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    return new Response(JSON.stringify({
        success: true,
        status: kycStatus,
        is_active: isActive,
        account: updatedAccount
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
