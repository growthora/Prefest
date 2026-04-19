import { withMiddleware } from "../_shared/middleware.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  assertCondition,
  errorResponse,
  getQueryParam,
  getRouteSegments,
  HttpError,
  parseJsonBody,
} from "../_shared/http.ts";
import { callLegacyFunction } from "../_shared/legacyProxy.ts";

const PROFILE_SELECT =
  "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at";

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "admin-api");

    if (req.method === "GET" && segments[0] === "settings") {
      return withMiddleware(req, { action: "admin_settings_get", roles: ["ADMIN"] }, async ({ serviceClient }) => {
        const [
          { data: system, error: systemError },
          { data: notifications, error: notifError },
          { data: smtp, error: smtpError },
          { data: integrations, error: intError },
        ] = await Promise.all([
          serviceClient.from("system_settings").select("*").maybeSingle(),
          serviceClient.from("notification_settings").select("*").maybeSingle(),
          serviceClient.from("smtp_settings").select("id, host, port, secure, username, from_email").maybeSingle(),
          serviceClient.from("integrations").select("*"),
        ]);

        if (systemError) throw new HttpError("SETTINGS_FETCH_FAILED", systemError.message, 400);
        if (notifError) throw new HttpError("NOTIFICATIONS_FETCH_FAILED", notifError.message, 400);
        if (smtpError) throw new HttpError("SMTP_FETCH_FAILED", smtpError.message, 400);
        if (intError) throw new HttpError("INTEGRATIONS_FETCH_FAILED", intError.message, 400);

        return {
          system: system || null,
          notifications: notifications || null,
          smtp: smtp || null,
          integrations: (integrations || []).map((item: any) => ({
            id: item.id,
            provider: item.provider,
            is_enabled: item.is_enabled,
            environment: item.environment,
            public_key: item.public_key,
            wallet_id: item.wallet_id,
            split_enabled: item.split_enabled,
            platform_fee_type: item.platform_fee_type,
            platform_fee_value: item.platform_fee_value,
          })),
        };
      });
    }

    if (req.method === "POST" && segments[0] === "settings" && segments[1] === "save") {
      return withMiddleware(req, { action: "admin_settings_save", roles: ["ADMIN"] }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "save-system-settings", {
          method: "POST",
          body,
        });
      });
    }

    if (req.method === "POST" && segments[0] === "settings" && segments[1] === "test-smtp") {
      return withMiddleware(req, { action: "admin_settings_test_smtp", roles: ["ADMIN"] }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "test-smtp-connection", {
          method: "POST",
          body,
        });
      });
    }

    if (segments[0] === "users") {
      if (req.method === "GET" && segments.length === 1) {
        return withMiddleware(req, { action: "admin_users_list", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient.from("profiles").select(PROFILE_SELECT).order("created_at", { ascending: false });
          if (error) throw new HttpError("USERS_FETCH_FAILED", error.message, 400);
          return { users: data || [] };
        });
      }

      if (req.method === "GET" && segments[1] === "with-stats") {
        return withMiddleware(req, { action: "admin_users_list_with_stats", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient
            .from("profiles")
            .select(`${PROFILE_SELECT}, event_participants!event_participants_user_id_fkey ( total_paid )`)
            .order("created_at", { ascending: false });

          if (error) throw new HttpError("USERS_WITH_STATS_FETCH_FAILED", error.message, 400);

          const users = (data || []).map((row: any) => {
            const participants = row.event_participants || [];
            return {
              ...row,
              total_events: participants.length,
              total_spent: participants.reduce((sum: number, participant: any) => sum + (Number(participant.total_paid) || 0), 0),
            };
          });

          return { users };
        });
      }

      if (req.method === "GET" && segments[1] === "pending-organizers") {
        return withMiddleware(req, { action: "admin_users_pending_organizers", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient
            .from("profiles")
            .select(PROFILE_SELECT)
            .eq("organizer_status", "PENDING")
            .order("created_at", { ascending: false });

          if (error) throw new HttpError("PENDING_ORGANIZERS_FETCH_FAILED", error.message, 400);
          return { users: data || [] };
        });
      }

      if (req.method === "GET" && segments[1] === "organizer-options") {
        return withMiddleware(req, { action: "admin_users_organizer_options", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient
            .from("profiles")
            .select("id, full_name, email, roles, organizer_status, account_type")
            .order("full_name", { ascending: true });

          if (error) throw new HttpError("ORGANIZER_OPTIONS_FETCH_FAILED", error.message, 400);

          const organizers = (data || [])
            .filter((profile: any) => {
              const roles = Array.isArray(profile.roles) ? profile.roles.map((role: string) => role.toUpperCase()) : [];
              const accountType = String(profile.account_type || "").toLowerCase();
              const approved = String(profile.organizer_status || "NONE").toUpperCase() === "APPROVED";
              return approved && (roles.includes("ORGANIZER") || accountType === "organizador" || accountType === "comprador_organizador");
            })
            .map((profile: any) => ({
              id: profile.id,
              full_name: profile.full_name || profile.email || "Organizador sem nome",
              email: profile.email || "",
            }));

          return { organizers };
        });
      }

      if (req.method === "GET" && segments[1] === "statistics") {
        return withMiddleware(req, { action: "admin_users_statistics", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const [{ count: totalUsers }, { count: totalEvents }] = await Promise.all([
            serviceClient.from("profiles").select("*", { count: "exact", head: true }),
            serviceClient.from("events").select("*", { count: "exact", head: true }),
          ]);

          const { data: confirmedPayments } = await serviceClient
            .from("payments")
            .select(
              `
              value,
              created_at,
              ticket:ticket_id(
                event_id,
                unit_price,
                quantity,
                discount_amount,
                events(title)
              )
            `,
            )
            .in("status", ["paid", "received", "confirmed", "PAID", "RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

          const paymentRows = confirmedPayments || [];
          const toOrganizerRevenue = (row: any) => {
            const unitPrice = Number(row?.ticket?.unit_price) || 0;
            const quantity = Number(row?.ticket?.quantity) || 1;
            const discount = Number(row?.ticket?.discount_amount) || 0;
            return Math.max(0, Number((unitPrice * quantity - discount).toFixed(2)));
          };

          const totalRevenue = paymentRows.reduce((sum: number, row: any) => {
            const organizerRevenue = toOrganizerRevenue(row);
            const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
            return sum + Number((organizerRevenue + platformFee).toFixed(2));
          }, 0);

          const now = new Date();
          const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          const startPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

          const currentMonthRevenue = paymentRows.reduce((sum: number, row: any) => {
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            if (createdAt && createdAt >= startCurrentMonth && createdAt < startNextMonth) {
              const organizerRevenue = toOrganizerRevenue(row);
              const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
              return sum + organizerRevenue + platformFee;
            }
            return sum;
          }, 0);

          const previousMonthRevenue = paymentRows.reduce((sum: number, row: any) => {
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            if (createdAt && createdAt >= startPreviousMonth && createdAt < startCurrentMonth) {
              const organizerRevenue = toOrganizerRevenue(row);
              const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
              return sum + organizerRevenue + platformFee;
            }
            return sum;
          }, 0);

          const revenueByEvent = paymentRows.reduce((acc: Record<string, any>, row: any) => {
            const eventId = row?.ticket?.event_id;
            if (!eventId) return acc;
            const organizerRevenue = toOrganizerRevenue(row);
            const platformFee = Number((organizerRevenue * 0.1).toFixed(2));
            const customerTotal = Number((organizerRevenue + platformFee).toFixed(2));
            const quantity = Number(row?.ticket?.quantity) || 1;

            if (!acc[eventId]) {
              acc[eventId] = {
                event_id: eventId,
                event_title: row?.ticket?.events?.title || "Sem titulo",
                event_price: Number(row?.ticket?.unit_price) || 0,
                revenue: 0,
                organizer_revenue: 0,
                platform_revenue: 0,
                tickets_sold: 0,
              };
            }

            acc[eventId].revenue += customerTotal;
            acc[eventId].organizer_revenue += organizerRevenue;
            acc[eventId].platform_revenue += platformFee;
            acc[eventId].tickets_sold += quantity;
            return acc;
          }, {});

          const { data: profilesCreated } = await serviceClient.from("profiles").select("created_at");
          const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekStartsOnMonday = (date: Date) => {
            const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const day = base.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            base.setDate(base.getDate() + diff);
            return base;
          };

          const startCurrentWeek = weekStartsOnMonday(dayStart);
          const startNextWeek = new Date(startCurrentWeek);
          startNextWeek.setDate(startCurrentWeek.getDate() + 7);
          const startPreviousWeek = new Date(startCurrentWeek);
          startPreviousWeek.setDate(startCurrentWeek.getDate() - 7);

          const currentWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
            const createdAt = profile.created_at ? new Date(profile.created_at) : null;
            return createdAt && createdAt >= startCurrentWeek && createdAt < startNextWeek ? sum + 1 : sum;
          }, 0);

          const previousWeekNewUsers = (profilesCreated || []).reduce((sum: number, profile: any) => {
            const createdAt = profile.created_at ? new Date(profile.created_at) : null;
            return createdAt && createdAt >= startPreviousWeek && createdAt < startCurrentWeek ? sum + 1 : sum;
          }, 0);

          const organizerRevenueTotal = paymentRows.reduce((sum: number, row: any) => sum + toOrganizerRevenue(row), 0);
          const prefestRevenue = Number((totalRevenue - organizerRevenueTotal).toFixed(2));
          const profitMargin = totalRevenue > 0 ? (prefestRevenue / totalRevenue) * 100 : 0;

          return {
            totalUsers: totalUsers || 0,
            totalEvents: totalEvents || 0,
            totalRevenue,
            estimatedCosts: organizerRevenueTotal,
            organizerRevenue: organizerRevenueTotal,
            prefestRevenue,
            profit: prefestRevenue,
            profitMargin,
            eventStats: Object.values(revenueByEvent),
            comparison: {
              currentMonthRevenue,
              previousMonthRevenue,
              currentWeekNewUsers,
              previousWeekNewUsers,
            },
          };
        });
      }

      if (req.method === "GET" && segments[1] === "by-username" && segments[2]) {
        return withMiddleware(req, { action: "admin_users_get_by_username", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const username = String(segments[2] || "").trim();
          const { data, error } = await serviceClient.from("profiles").select(PROFILE_SELECT).eq("username", username).maybeSingle();
          if (error) throw new HttpError("USER_FETCH_BY_USERNAME_FAILED", error.message, 400);
          return { user: data || null };
        });
      }

      if (req.method === "POST" && segments.length === 1) {
        return withMiddleware(req, { action: "admin_users_create", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const body = await parseJsonBody<{ userData?: Record<string, any> }>(req);
          const userData = body.userData ?? {};
          const email = String(userData.email || "").trim();
          const password = String(userData.password || "");
          const fullName = String(userData.full_name || "").trim();

          assertCondition(email && password && fullName, "INVALID_PARAMS", "Parametros invalidos", 400);

          const { data: created, error } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });

          if (error) throw new HttpError("USER_CREATE_FAILED", error.message, 400);
          assertCondition(created?.user?.id, "USER_CREATE_FAILED", "Falha ao criar usuario", 400);

          const targetUserId = created!.user!.id;
          const updatePayload: Record<string, unknown> = {
            full_name: fullName,
            updated_at: new Date().toISOString(),
          };
          if (userData.roles) updatePayload.roles = userData.roles;
          if (userData.role) updatePayload.role = userData.role;
          if (userData.account_type) updatePayload.account_type = userData.account_type;
          if (userData.organizer_status) updatePayload.organizer_status = userData.organizer_status;

          for (let attempt = 0; attempt < 8; attempt += 1) {
            const { data: existingProfile, error: profileError } = await serviceClient
              .from("profiles")
              .select("id")
              .eq("id", targetUserId)
              .maybeSingle();

            if (profileError) throw new HttpError("PROFILE_WAIT_FAILED", profileError.message, 400);
            if (existingProfile) {
              const { error: updateError } = await serviceClient.from("profiles").update(removeUndefined(updatePayload) as never).eq("id", targetUserId);
              if (updateError) throw new HttpError("PROFILE_UPDATE_FAILED", updateError.message, 400);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          const { data: profile, error: fetchError } = await serviceClient.from("profiles").select(PROFILE_SELECT).eq("id", targetUserId).maybeSingle();
          if (fetchError) throw new HttpError("PROFILE_FETCH_FAILED", fetchError.message, 400);
          return { user: created!.user, profile };
        });
      }

      if (segments[1] && !["with-stats", "pending-organizers", "organizer-options", "statistics", "by-username"].includes(segments[1])) {
        const userId = String(segments[1] || "").trim();

        if (req.method === "GET" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_users_get_by_id", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { data, error } = await serviceClient.from("profiles").select(PROFILE_SELECT).eq("id", userId).maybeSingle();
            if (error) throw new HttpError("USER_FETCH_FAILED", error.message, 400);
            return { user: data || null };
          });
        }

        if (req.method === "PUT" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_users_update", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ updates?: Record<string, unknown> }>(req);
            const updates = body.updates ?? {};
            const allowedKeys = new Set([
              "full_name",
              "bio",
              "city",
              "avatar_url",
              "roles",
              "role",
              "account_type",
              "organizer_status",
              "single_mode",
              "match_enabled",
              "show_initials_only",
              "match_intention",
              "match_gender_preference",
              "gender_identity",
              "sexuality",
              "meet_attendees",
              "looking_for",
              "height",
              "relationship_status",
              "allow_profile_view",
              "privacy_settings",
              "username",
            ]);

            const out: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(updates)) {
              if (allowedKeys.has(key)) out[key] = value;
            }
            out.updated_at = new Date().toISOString();

            const sanitized = removeUndefined(out);
            const { data, error } = await serviceClient.rpc("admin_update_profile", {
              p_user_id: userId,
              p_updates: sanitized,
            });

            if (error) throw new HttpError("USER_UPDATE_FAILED", error.message, 400);
            return { user: data };
          });
        }

        if (req.method === "DELETE" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_users_delete", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { data: targetProfile, error: targetProfileError } = await serviceClient
              .from("profiles")
              .select("id")
              .eq("id", userId)
              .maybeSingle();

            if (targetProfileError) throw new HttpError("USER_FETCH_FAILED", targetProfileError.message, 400);
            if (!targetProfile) throw new HttpError("USER_NOT_FOUND", "Usuario nao encontrado", 404);

            const { data: ticketRows, error: ticketRowsError } = await serviceClient.from("tickets").select("id").eq("buyer_user_id", userId);
            if (ticketRowsError) throw new HttpError("TICKET_FETCH_FAILED", ticketRowsError.message, 400);

            const ticketIds = (ticketRows || []).map((ticket: any) => ticket.id);
            if (ticketIds.length > 0) {
              const { error: paymentsByTicketError } = await serviceClient.from("payments").delete().in("ticket_id", ticketIds as never);
              if (paymentsByTicketError) throw new HttpError("PAYMENTS_DELETE_FAILED", paymentsByTicketError.message, 400);

              const { error: ticketsError } = await serviceClient.from("tickets").delete().in("id", ticketIds as never);
              if (ticketsError) throw new HttpError("TICKETS_DELETE_FAILED", ticketsError.message, 400);
            }

            const { error: eventParticipantsError } = await serviceClient.from("event_participants").delete().eq("user_id", userId);
            if (eventParticipantsError) throw new HttpError("EVENT_PARTICIPANTS_DELETE_FAILED", eventParticipantsError.message, 400);

            const { data: matchRows, error: matchRowsError } = await serviceClient.from("matches").select("id").or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
            if (matchRowsError) throw new HttpError("MATCHES_FETCH_FAILED", matchRowsError.message, 400);

            const matchIds = (matchRows || []).map((match: any) => match.id);
            if (matchIds.length > 0) {
              const { error: matchesError } = await serviceClient.from("matches").delete().in("id", matchIds as never);
              if (matchesError) throw new HttpError("MATCHES_DELETE_FAILED", matchesError.message, 400);
            }

            await serviceClient.from("roles_audit_logs").delete().eq("target_user_id", userId);
            await serviceClient.from("roles_audit_logs").delete().eq("performed_by", userId);
            await serviceClient.from("team_members").delete().eq("user_id", userId);
            await serviceClient.from("team_members").delete().eq("organizer_id", userId);

            const { error: profileDeleteError } = await serviceClient.from("profiles").delete().eq("id", userId);
            if (profileDeleteError) throw new HttpError("PROFILE_DELETE_FAILED", profileDeleteError.message, 400);

            const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(userId);
            if (authDeleteError) throw new HttpError("AUTH_DELETE_FAILED", authDeleteError.message, 400);

            return { ok: true };
          });
        }

        if (req.method === "PUT" && segments[2] === "password") {
          return withMiddleware(req, { action: "admin_users_update_password", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ newPassword?: string }>(req);
            const newPassword = String(body.newPassword || "");
            assertCondition(newPassword.length >= 8, "INVALID_PASSWORD", "A senha deve ter no minimo 8 caracteres", 400);

            const { error } = await serviceClient.auth.admin.updateUserById(userId, {
              password: newPassword,
              email_confirm: true,
            });

            if (error) throw new HttpError("USER_PASSWORD_UPDATE_FAILED", error.message, 400);
            return { ok: true };
          });
        }

        if (req.method === "PUT" && segments[2] === "organizer-status") {
          return withMiddleware(req, { action: "admin_users_update_organizer_status", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ status?: string }>(req);
            const status = String(body.status || "").trim();
            assertCondition(status, "INVALID_STATUS", "Status invalido", 400);

            const { error } = await serviceClient
              .from("profiles")
              .update({ organizer_status: status, updated_at: new Date().toISOString() } as never)
              .eq("id", userId);

            if (error) throw new HttpError("ORGANIZER_STATUS_UPDATE_FAILED", error.message, 400);
            return { ok: true };
          });
        }

        if (req.method === "POST" && segments[2] === "request-organizer-access") {
          return withMiddleware(req, { action: "admin_users_request_organizer_access", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { data: existing, error: existingError } = await serviceClient.from("profiles").select("roles").eq("id", userId).maybeSingle();
            if (existingError) throw new HttpError("USER_FETCH_FAILED", existingError.message, 400);

            const currentRoles = Array.isArray(existing?.roles) ? existing.roles : ["BUYER"];
            const normalized = currentRoles.map((role: unknown) => String(role).toUpperCase());
            const nextRoles = normalized.includes("ORGANIZER") ? normalized : [...normalized, "ORGANIZER"];

            const { error } = await serviceClient
              .from("profiles")
              .update({ roles: nextRoles, organizer_status: "PENDING", updated_at: new Date().toISOString() } as never)
              .eq("id", userId);

            if (error) throw new HttpError("REQUEST_ORGANIZER_ACCESS_FAILED", error.message, 400);
            return { ok: true };
          });
        }

        if (req.method === "GET" && segments[2] === "team-organizer") {
          return withMiddleware(req, { action: "admin_users_get_team_organizer", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { data, error } = await serviceClient.from("team_members").select("organizer_id").eq("user_id", userId).maybeSingle();
            if (error) throw new HttpError("TEAM_LINK_FETCH_FAILED", error.message, 400);
            return { organizerId: data?.organizer_id || null };
          });
        }

        if (req.method === "PUT" && segments[2] === "team-organizer") {
          return withMiddleware(req, { action: "admin_users_upsert_team_organizer", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ organizerId?: string }>(req);
            const organizerId = String(body.organizerId || "").trim();
            assertCondition(organizerId, "INVALID_ORGANIZER_ID", "Parametros invalidos", 400);

            const { error } = await serviceClient.from("team_members").upsert(
              { user_id: userId, organizer_id: organizerId } as never,
              { onConflict: "user_id" },
            );

            if (error) throw new HttpError("TEAM_LINK_UPSERT_FAILED", error.message, 400);
            return { ok: true };
          });
        }

        if (req.method === "DELETE" && segments[2] === "team-organizer") {
          return withMiddleware(req, { action: "admin_users_remove_team_organizer", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { error } = await serviceClient.from("team_members").delete().eq("user_id", userId);
            if (error) throw new HttpError("TEAM_LINK_DELETE_FAILED", error.message, 400);
            return { ok: true };
          });
        }
      }
    }

    if (segments[0] === "coupons") {
      if (req.method === "GET" && segments.length === 1) {
        return withMiddleware(req, { action: "admin_coupons_list", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient
            .from("coupons")
            .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
            .order("created_at", { ascending: false });

          if (error) throw new HttpError("COUPONS_FETCH_FAILED", error.message, 400);
          return { coupons: data || [] };
        });
      }

      if (req.method === "POST" && segments.length === 1) {
        return withMiddleware(req, { action: "admin_coupons_create", roles: ["ADMIN"] }, async ({ user, serviceClient }) => {
          const body = await parseJsonBody<{ couponData?: Record<string, any> }>(req);
          const couponData = body.couponData ?? {};
          const code = String(couponData.code || "").trim().toUpperCase();
          const discount_type = String(couponData.discount_type || "").trim();
          const discount_value = Number(couponData.discount_value || 0);
          const max_uses = couponData.max_uses != null ? Number(couponData.max_uses) : null;
          const valid_from = couponData.valid_from ? String(couponData.valid_from) : new Date().toISOString();
          const valid_until = couponData.valid_until ? String(couponData.valid_until) : null;
          const description = couponData.description != null ? String(couponData.description) : null;

          if (!code || (discount_type !== "percentage" && discount_type !== "fixed") || !Number.isFinite(discount_value)) {
            throw new HttpError("INVALID_PARAMS", "Parametros invalidos", 400);
          }

          const { data, error } = await serviceClient
            .from("coupons")
            .insert({
              code,
              description,
              discount_type,
              discount_value,
              max_uses,
              valid_from,
              valid_until,
              active: true,
              created_by: user!.id,
            } as never)
            .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
            .single();

          if (error) throw new HttpError("COUPON_CREATE_FAILED", error.message, 400);
          return { coupon: data };
        });
      }

      if (req.method === "GET" && segments[1] === "usage") {
        return withMiddleware(req, { action: "admin_coupons_usage_list", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const couponId = getQueryParam(req, "couponId");
          let query = serviceClient
            .from("coupon_usage")
            .select("id, coupon_id, user_id, event_id, discount_applied, used_at")
            .order("used_at", { ascending: false });

          if (couponId) query = query.eq("coupon_id", couponId);
          const { data, error } = await query;
          if (error) throw new HttpError("COUPON_USAGE_FETCH_FAILED", error.message, 400);
          return { usage: data || [] };
        });
      }

      if (segments[1]) {
        const couponId = String(segments[1] || "").trim();

        if (req.method === "PUT" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_coupons_update", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ updates?: Record<string, unknown> }>(req);
            const updates = body.updates ?? {};
            const allowedKeys = new Set([
              "code",
              "description",
              "discount_type",
              "discount_value",
              "max_uses",
              "valid_from",
              "valid_until",
              "active",
            ]);

            const out: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(updates)) {
              if (!allowedKeys.has(key)) continue;
              out[key] = key === "code" ? String(value || "").trim().toUpperCase() : value;
            }

            const normalizedOut = removeUndefined(out);
            if (Object.keys(normalizedOut).length === 0) throw new HttpError("NOTHING_TO_UPDATE", "Nada para atualizar", 400);

            const { data, error } = await serviceClient
              .from("coupons")
              .update(normalizedOut as never)
              .eq("id", couponId)
              .select("id, code, description, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, active, created_by, created_at")
              .single();

            if (error) throw new HttpError("COUPON_UPDATE_FAILED", error.message, 400);
            return { coupon: data };
          });
        }

        if (req.method === "DELETE" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_coupons_delete", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { error } = await serviceClient.from("coupons").delete().eq("id", couponId);
            if (error) throw new HttpError("COUPON_DELETE_FAILED", error.message, 400);
            return { ok: true };
          });
        }
      }
    }

    if (segments[0] === "event-requests") {
      if (req.method === "GET" && segments.length === 1) {
        return withMiddleware(req, { action: "admin_event_requests_list", roles: ["ADMIN"] }, async ({ serviceClient }) => {
          const { data, error } = await serviceClient
            .from("event_requests")
            .select("id, user_name, event_name, email, phone, city, event_location, status, notes, created_at, updated_at")
            .order("created_at", { ascending: false });

          if (error) throw new HttpError("EVENT_REQUESTS_FETCH_FAILED", error.message, 400);
          return { requests: data || [] };
        });
      }

      if (segments[1]) {
        const requestId = String(segments[1] || "").trim();

        if (req.method === "PUT" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_event_requests_update", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const body = await parseJsonBody<{ status?: string; notes?: string }>(req);
            const status = String(body.status || "").trim();
            const notes = body.notes !== undefined ? String(body.notes || "") : undefined;
            if (!status) throw new HttpError("INVALID_STATUS", "Parametros invalidos", 400);

            const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
            if (notes !== undefined) updateData.notes = notes;

            const { error } = await serviceClient.from("event_requests").update(updateData as never).eq("id", requestId);
            if (error) throw new HttpError("EVENT_REQUEST_UPDATE_FAILED", error.message, 400);
            return { ok: true };
          });
        }

        if (req.method === "DELETE" && segments.length === 2) {
          return withMiddleware(req, { action: "admin_event_requests_delete", roles: ["ADMIN"] }, async ({ serviceClient }) => {
            const { error } = await serviceClient.from("event_requests").delete().eq("id", requestId);
            if (error) throw new HttpError("EVENT_REQUEST_DELETE_FAILED", error.message, 400);
            return { ok: true };
          });
        }
      }
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
