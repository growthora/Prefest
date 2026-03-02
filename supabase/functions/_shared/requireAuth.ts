
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export async function requireAuth(req: Request): Promise<{ user: User; supabase: SupabaseClient }> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const token = authHeader.replace('Bearer ', '').trim()

  // Create client with the auth header to respect RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Verify the token securely
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user) {
    throw new Response(
      JSON.stringify({ error: 'Invalid JWT' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return { user: data.user, supabase }
}
