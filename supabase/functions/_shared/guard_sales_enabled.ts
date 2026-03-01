
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface GuardOptions {
  organizerUserId?: string;
  walletId?: string;
}

export async function guardSalesEnabled(
  supabaseClient: SupabaseClient,
  options: GuardOptions
): Promise<{ 
  isValid: boolean; 
  error?: string; 
  code?: string; 
  account?: any 
}> {
  console.log(`[guardSalesEnabled] Checking status for organizer:`, options)
  
  let query = supabaseClient.from('organizer_asaas_accounts').select('*').single()
  
  if (options.organizerUserId) {
    query = supabaseClient
      .from('organizer_asaas_accounts')
      .select('*')
      .eq('organizer_user_id', options.organizerUserId)
      .single()
  } else if (options.walletId) {
    query = supabaseClient
      .from('organizer_asaas_accounts')
      .select('*')
      .eq('asaas_account_id', options.walletId)
      .single()
  } else {
    return { 
      isValid: false, 
      error: 'Missing organizer identification', 
      code: 'MISSING_ORGANIZER_ID' 
    }
  }

  const { data: orgAccount, error: orgError } = await query

  if (orgError) {
    console.error(`[guardSalesEnabled] Error fetching account:`, orgError)
    if (orgError.code === 'PGRST116') { // No rows found
      return { 
        isValid: false, 
        error: 'Organizer not connected to Asaas', 
        code: 'ASAAS_NOT_CONNECTED' 
      }
    }
    return { 
      isValid: false, 
      error: 'Error validating organizer status', 
      code: 'INTERNAL_ERROR' 
    }
  }

  if (!orgAccount) {
    return { 
      isValid: false, 
      error: 'Organizer not connected to Asaas', 
      code: 'ASAAS_NOT_CONNECTED' 
    }
  }

  if (!orgAccount.is_active || orgAccount.kyc_status !== 'approved') {
    console.warn(`[guardSalesEnabled] Account not active/approved. Status: ${orgAccount.kyc_status}, Active: ${orgAccount.is_active}`)
    return { 
      isValid: false, 
      error: 'Organizer Asaas account is not active/approved', 
      code: 'ASAAS_NOT_APPROVED',
      account: orgAccount
    }
  }

  return { isValid: true, account: orgAccount }
}
