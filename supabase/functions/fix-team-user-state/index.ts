import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);
}

function hasEmailConfirmationUpdateError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('email confirmation required to update profile details');
}

Deno.serve(async () => {
  try {
    const email = 'teste@teste.teste';
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ ok: false, step: 'profile_read', error: profileError?.message || 'profile not found' }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    const nextRoles = normalizeRoles(profile.roles).filter((role) => role !== 'EQUIPE');
    if (!nextRoles.includes('BUYER')) nextRoles.unshift('BUYER');

    const payload = {
      ...profile,
      roles: nextRoles,
      organizer_status: 'NONE',
      role: 'user',
      account_type: 'comprador',
      updated_at: new Date().toISOString(),
    } as any;

    let { error: profileUpdateError } = await admin
      .from('profiles')
      .update({
        roles: payload.roles,
        organizer_status: payload.organizer_status,
        role: payload.role,
        account_type: payload.account_type,
        updated_at: payload.updated_at,
      } as any)
      .eq('id', profile.id);

    if (profileUpdateError && hasEmailConfirmationUpdateError(profileUpdateError)) {
      const { error: deleteProfileError } = await admin.from('profiles').delete().eq('id', profile.id);
      if (deleteProfileError) {
        return new Response(JSON.stringify({ ok: false, step: 'profile_delete_for_recreate', error: deleteProfileError.message }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }

      const { error: insertProfileError } = await admin.from('profiles').insert(payload);
      if (insertProfileError) {
        return new Response(JSON.stringify({ ok: false, step: 'profile_reinsert', error: insertProfileError.message }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      }
      profileUpdateError = null;
    }

    if (profileUpdateError) {
      return new Response(JSON.stringify({ ok: false, step: 'profile_update', error: profileUpdateError.message }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    const { error: teamDeleteError } = await admin.from('team_members').delete().eq('user_id', profile.id);
    if (teamDeleteError) {
      return new Response(JSON.stringify({ ok: false, step: 'team_delete', error: teamDeleteError.message }), { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: profile.id, roles: nextRoles }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, step: 'catch', error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
});