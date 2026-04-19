import { withMiddleware, createAnonClient } from "../_shared/middleware.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  assertCondition,
  assertMethod,
  getRouteSegments,
  HttpError,
  parseJsonBody,
} from "../_shared/http.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const segments = getRouteSegments(req, "auth-api");
  const routeKey = [req.method.toUpperCase(), ...segments].join(" ");

  if (routeKey === "POST register check") {
    return withMiddleware(
      req,
      { action: "auth_check_registration_data", requireAuth: false },
      async () => {
        const body = await parseJsonBody<{ email?: string; cpf?: string }>(req);
        const email = String(body.email || "").trim();
        const cpf = String(body.cpf || "").trim();

        assertCondition(email && cpf, "INVALID_PARAMS", "Parametros invalidos", 400);

        const anon = createAnonClient();
        const { data, error } = await anon.rpc("check_registration_data", {
          check_email: email,
          check_cpf: cpf,
        });

        if (error) throw new HttpError("CHECK_REGISTRATION_FAILED", error.message, 400);
        return data || { email_exists: false, cpf_exists: false };
      },
    );
  }

  if (routeKey === "POST signup sync-roles") {
    return withMiddleware(
      req,
      { action: "auth_sync_signup_roles" },
      async ({ user, supabase }) => {
        const body = await parseJsonBody<{ isOrganizer?: boolean }>(req);
        const isOrganizer = Boolean(body.isOrganizer);

        const { error } = await supabase!
          .from("profiles")
          .update({
            roles: ["BUYER", ...(isOrganizer ? ["ORGANIZER"] : [])],
            organizer_status: isOrganizer ? "PENDING" : "NONE",
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", user!.id);

        if (error) throw new HttpError("SYNC_SIGNUP_ROLES_FAILED", error.message, 400);
        return { ok: true };
      },
    );
  }

  if (routeKey === "PUT password") {
    return withMiddleware(
      req,
      { action: "auth_force_update_password" },
      async ({ user, serviceClient }) => {
        const body = await parseJsonBody<{ currentPassword?: string; newPassword?: string }>(req);
        const currentPassword = String(body.currentPassword || "");
        const newPassword = String(body.newPassword || "");

        assertCondition(currentPassword, "CURRENT_PASSWORD_REQUIRED", "Senha atual e obrigatoria", 400);
        assertCondition(newPassword.length >= 6, "INVALID_PASSWORD", "A senha deve ter no minimo 6 caracteres", 400);

        const email = String(user?.email || "").trim();
        assertCondition(email, "EMAIL_NOT_FOUND", "Email do usuario nao encontrado", 400);

        const anon = createAnonClient();
        const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

        if (signInError || !signInData.user?.id) {
          throw new HttpError("INVALID_CURRENT_PASSWORD", "Senha atual incorreta", 400);
        }

        if (String(signInData.user.id) !== String(user?.id)) {
          throw new HttpError("FORBIDDEN", "Credenciais invalidas", 403);
        }

        const { error } = await serviceClient.auth.admin.updateUserById(user!.id, {
          password: newPassword,
          email_confirm: true,
        });

        if (error) throw new HttpError("UPDATE_PASSWORD_FAILED", error.message, 400);
        return { ok: true };
      },
    );
  }

  assertMethod(req, []);
  throw new HttpError("NOT_FOUND", "Rota nao encontrada", 404);
});
