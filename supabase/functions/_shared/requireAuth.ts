
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'

export async function requireAuth(req: Request): Promise<{ user: User; supabase: SupabaseClient }> {
  // FASE 1: PROVA DEFINITIVA - DIAGNÃ“STICO
  const authHeader = req.headers.get('Authorization') ?? ""
  // console.log("[AUTH] present:", Boolean(authHeader))
  // console.log("[AUTH] prefix:", authHeader.slice(0, 18)) 
  // console.log("[AUTH] len:", authHeader.length)

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // console.error("[AUTH] Missing or invalid Authorization header");
    throw new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }

  const jwt = authHeader.replace('Bearer ', '').trim()

  // FASE 3: VALIDAR JWT DO JEITO CANÃ”NICO
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Criar client com o token no header global (Contexto do UsuÃ¡rio)
  const userClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )

  // Validar usuÃ¡rio usando getUser() (sem passar token manualmente, usa o do client)
  const { data: { user }, error } = await userClient.auth.getUser()

  if (error || !user) {
    // console.error("[AUTH] Invalid JWT or User not found:", error);
    throw new Response(
      JSON.stringify({ error: 'Invalid JWT' }),
      { status: 401, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }

  // Retornar usuÃ¡rio validado e o client autenticado
  return { user, supabase: userClient }
}
