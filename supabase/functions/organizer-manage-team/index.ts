import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/requireAuth.ts";
import { requireRole } from "../_shared/requireRole.ts";

type TeamAction = "list" | "create" | "remove";

interface TeamRequest {
  action?: TeamAction;
  fullName?: string;
  email?: string;
  password?: string;
  memberUserId?: string;
}

function asJson(status: number, body: unknown, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);
}

function hasEmailConfirmationUpdateError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();
  return msg.includes("email confirmation required to update profile details");
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { user, supabase: userClient } = await requireAuth(req);
    await requireRole(userClient, user.id, ["ORGANIZER", "ADMIN"]);

    let body: TeamRequest = {};
    try {
      body = await req.json();
    } catch {
      return asJson(400, { ok: false, error: "JSON invalido" }, corsHeaders);
    }

    const action = String(body.action || "list").trim().toLowerCase() as TeamAction;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return asJson(500, { ok: false, error: "Missing Supabase service credentials" }, corsHeaders);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id, roles")
      .eq("id", user.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return asJson(403, { ok: false, error: "Organizer profile not found" }, corsHeaders);
    }

    const callerRoles = normalizeRoles(callerProfile.roles);
    if (!callerRoles.includes("ORGANIZER") && !callerRoles.includes("ADMIN")) {
      return asJson(403, { ok: false, error: "Only organizers can manage team members" }, corsHeaders);
    }

    if (action === "list") {
      const { data: members, error: membersError } = await adminClient
        .from("team_members")
        .select("id, organizer_id, user_id, created_at, profiles:user_id(id, full_name, email, roles)")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });

      if (membersError) {
        return asJson(400, { ok: false, error: membersError.message }, corsHeaders);
      }

      return asJson(
        200,
        {
          ok: true,
          members: (members || []).map((row: any) => ({
            id: row.id,
            organizer_id: row.organizer_id,
            user_id: row.user_id,
            created_at: row.created_at,
            full_name: row.profiles?.full_name || null,
            email: row.profiles?.email || null,
            roles: normalizeRoles(row.profiles?.roles),
          })),
        },
        corsHeaders,
      );
    }

    if (action === "create") {
      const fullName = String(body.fullName || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!fullName || !email || !password) {
        return asJson(400, { ok: false, error: "Name, email and password are required" }, corsHeaders);
      }

      if (password.length < 8) {
        return asJson(400, { ok: false, error: "A senha deve ter no minimo 8 caracteres" }, corsHeaders);
      }

      const { count, error: countError } = await adminClient
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("organizer_id", user.id);

      if (countError) {
        return asJson(400, { ok: false, error: `count_check: ${countError.message}` }, corsHeaders);
      }

      if ((count || 0) >= 2) {
        return asJson(400, { ok: false, error: "Limite de 2 membros por organizador atingido" }, corsHeaders);
      }

      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile?.id) {
        return asJson(
          400,
          {
            ok: false,
            error:
              "Esse e-mail ja e um usuario nosso, portanto nao pode ser habilitado para funcao de equipe nele. Entre em contato com nosso suporte e solicite internamente.",
          },
          corsHeaders,
        );
      }

      const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createUserError || !createdUserData?.user?.id) {
        return asJson(400, { ok: false, error: `create_user: ${createUserError?.message || "failed"}` }, corsHeaders);
      }

      const createdUserId = createdUserData.user.id;

      let { error: profileUpdateError } = await adminClient
        .from("profiles")
        .update({
          full_name: fullName,
          roles: ["BUYER", "EQUIPE"],
          organizer_status: "NONE",
          role: "user",
          account_type: "comprador",
        } as any)
        .eq("id", createdUserId);

      // Some projects have DB rules that reject UPDATE when caller email is unconfirmed.
      // Fallback: recreate profile row using service role to avoid update path.
      if (profileUpdateError && hasEmailConfirmationUpdateError(profileUpdateError)) {
        const { error: deleteProfileError } = await adminClient
          .from("profiles")
          .delete()
          .eq("id", createdUserId);

        if (!deleteProfileError) {
          const { error: insertProfileError } = await adminClient
            .from("profiles")
            .insert({
              id: createdUserId,
              email,
              full_name: fullName,
              roles: ["BUYER", "EQUIPE"],
              organizer_status: "NONE",
              role: "user",
              account_type: "comprador",
            } as any);

          profileUpdateError = insertProfileError || null;
        }
      }

      if (profileUpdateError) {
        await adminClient.auth.admin.deleteUser(createdUserId);
        return asJson(400, { ok: false, error: `profile_write: ${profileUpdateError.message}` }, corsHeaders);
      }

      const { data: teamRow, error: teamInsertError } = await adminClient
        .from("team_members")
        .insert({ organizer_id: user.id, user_id: createdUserId })
        .select("id, organizer_id, user_id, created_at")
        .single();

      if (teamInsertError) {
        await adminClient.auth.admin.deleteUser(createdUserId);
        return asJson(400, { ok: false, error: `team_insert: ${teamInsertError.message}` }, corsHeaders);
      }

      return asJson(
        200,
        {
          ok: true,
          member: {
            ...teamRow,
            full_name: fullName,
            email,
            roles: ["BUYER", "EQUIPE"],
          },
        },
        corsHeaders,
      );
    }

    if (action === "remove") {
      const memberUserId = String(body.memberUserId || "").trim();
      if (!memberUserId) {
        return asJson(400, { ok: false, error: "memberUserId is required" }, corsHeaders);
      }

      const { data: teamRow, error: teamRowError } = await adminClient
        .from("team_members")
        .select("id, organizer_id, user_id")
        .eq("organizer_id", user.id)
        .eq("user_id", memberUserId)
        .single();

      if (teamRowError || !teamRow) {
        return asJson(404, { ok: false, error: "Team member not found" }, corsHeaders);
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(memberUserId);
      if (deleteAuthError) {
        return asJson(400, { ok: false, error: `delete_user: ${deleteAuthError.message}` }, corsHeaders);
      }

      return asJson(200, { ok: true }, corsHeaders);
    }

    return asJson(400, { ok: false, error: "Invalid action" }, corsHeaders);
  } catch (error: any) {
    return asJson(500, { ok: false, error: error?.message || "Erro interno" }, getCorsHeaders(req));
  }
});

