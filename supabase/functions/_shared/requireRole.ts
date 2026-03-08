
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  allowedRoles: string[]
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('roles')
    .eq('id', userId)
    .single()

  // Check if user has at least one of the allowed roles
  // Note: roles is an array of strings. e.g. ['ADMIN', 'FINANCEIRO']
  if (error || !data || !data.roles || !allowedRoles.some(r => data.roles.includes(r))) {
    throw new Response(
      JSON.stringify({ error: 'Access denied: Insufficient permissions' }),
      { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }
}
