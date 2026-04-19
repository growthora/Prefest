import { withMiddleware } from "../_shared/middleware.ts";
import { handleCors } from "../_shared/cors.ts";
import {
  assertCondition,
  errorResponse,
  getRouteSegments,
  HttpError,
  parseJsonBody,
} from "../_shared/http.ts";
import { callLegacyFunction } from "../_shared/legacyProxy.ts";

const PROFILE_SELECT =
  "id, email, full_name, cpf, birth_date, phone, city, avatar_url, bio, roles, organizer_status, role, account_type, single_mode, show_initials_only, match_intention, match_gender_preference, gender_identity, sexuality, meet_attendees, match_enabled, looking_for, height, relationship_status, last_seen, privacy_settings, allow_profile_view, username, created_at, updated_at";

function calculateAge(birthDate: string | null) {
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (Number.isNaN(bd.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - bd.getFullYear();
  const monthDiff = today.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
    years -= 1;
  }
  return years;
}

function mapPublicProfile(profile: Record<string, any>) {
  const isVisible = profile.meet_attendees || profile.match_enabled || profile.single_mode;
  if (!isVisible) {
    return {
      id: profile.id,
      name: profile.full_name,
      photo: profile.avatar_url,
      is_visible: false,
    };
  }

  const lastSeen = profile.last_seen ? new Date(profile.last_seen) : null;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  return {
    id: profile.id,
    name: profile.full_name,
    photo: profile.avatar_url,
    bio: profile.bio,
    age: calculateAge(profile.birth_date),
    height: profile.height,
    relationshipStatus: profile.relationship_status,
    matchIntention: profile.match_intention,
    genderIdentity: profile.gender_identity,
    sexuality: profile.sexuality,
    genderPreference: profile.match_gender_preference,
    vibes: profile.vibes || [],
    lookingFor: profile.looking_for || [],
    lastSeen: profile.last_seen,
    isOnline: Boolean(lastSeen && lastSeen > fiveMinutesAgo),
    is_visible: true,
  };
}

Deno.serve(async (req) => {
  try {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const segments = getRouteSegments(req, "profile-api");
    const routeKey = [req.method.toUpperCase(), ...segments].join(" ");

    if (routeKey === "GET me") {
      return withMiddleware(req, { action: "profile_get_self" }, async ({ user, supabase }) => {
        const { data, error } = await supabase!
          .from("profiles")
          .select(PROFILE_SELECT)
          .eq("id", user!.id)
          .maybeSingle();

        if (error) throw new HttpError("PROFILE_FETCH_FAILED", error.message, 400);
        return { profile: data || null };
      });
    }

    if (routeKey === "PUT me") {
      return withMiddleware(req, { action: "profile_update_self" }, async ({ user, supabase }) => {
        const body = await parseJsonBody<{ updates?: Record<string, unknown> }>(req);
        const updates = body.updates ?? {};
        const allowedKeys = new Set([
          "full_name",
          "cpf",
          "birth_date",
          "phone",
          "city",
          "avatar_url",
          "bio",
          "single_mode",
          "show_initials_only",
          "match_intention",
          "match_gender_preference",
          "gender_identity",
          "sexuality",
          "meet_attendees",
          "match_enabled",
          "looking_for",
          "height",
          "relationship_status",
          "last_seen",
          "privacy_settings",
          "allow_profile_view",
          "username",
        ]);

        const toSave: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (allowedKeys.has(key)) toSave[key] = value;
        }
        toSave.updated_at = new Date().toISOString();

        const { data, error } = await supabase!
          .from("profiles")
          .update(toSave as never)
          .eq("id", user!.id)
          .select(PROFILE_SELECT)
          .single();

        if (error) throw new HttpError("PROFILE_UPDATE_FAILED", error.message, 400);
        return { profile: data };
      });
    }

    if (routeKey === "GET me checkout") {
      return withMiddleware(req, { action: "profile_checkout_data" }, async ({ user, supabase }) => {
        const { data, error } = await supabase!
          .from("profiles")
          .select("full_name, cpf, email, phone, birth_date")
          .eq("id", user!.id)
          .maybeSingle();

        if (error) throw new HttpError("PROFILE_CHECKOUT_FETCH_FAILED", error.message, 400);
        return { profile: data || null };
      });
    }

    if (routeKey === "GET me match-gender-preference") {
      return withMiddleware(req, { action: "profile_get_match_gender_preference" }, async ({ user, supabase }) => {
        const { data, error } = await supabase!
          .from("profiles")
          .select("match_gender_preference")
          .eq("id", user!.id)
          .maybeSingle();

        if (error) throw new HttpError("PROFILE_PREFERENCE_FETCH_FAILED", error.message, 400);
        return { match_gender_preference: data?.match_gender_preference ?? null };
      });
    }

    if (routeKey === "POST complete") {
      return withMiddleware(req, { action: "profile_complete" }, async ({ req: request }) => {
        const body = await parseJsonBody<Record<string, unknown>>(request);
        return await callLegacyFunction(request, "complete-profile", {
          method: "POST",
          body,
        });
      });
    }

    if (routeKey === "GET genders") {
      return withMiddleware(req, { action: "profile_genders_list" }, async ({ supabase }) => {
        const { data, error } = await supabase!
          .from("genders")
          .select("code, label")
          .order("sort_order", { ascending: true });

        if (error) throw new HttpError("GENDERS_FETCH_FAILED", error.message, 400);
        return { genders: data || [] };
      });
    }

    if (req.method === "GET" && segments[0] === "public" && segments[1]) {
      return withMiddleware(req, { action: "profile_get_public" }, async ({ supabase }) => {
        const profileUserId = String(segments[1] || "").trim();
        assertCondition(profileUserId, "INVALID_USER_ID", "userId invalido", 400);

        const { data: profile, error } = await supabase!
          .from("profiles")
          .select(
            "id, full_name, bio, avatar_url, meet_attendees, match_enabled, single_mode, show_initials_only, gender_identity, match_intention, match_gender_preference, sexuality, looking_for, height, relationship_status, birth_date, vibes, last_seen",
          )
          .eq("id", profileUserId)
          .single();

        if (error) throw new HttpError("PUBLIC_PROFILE_FETCH_FAILED", error.message, 400);
        return { profile: profile ? mapPublicProfile(profile as Record<string, any>) : null };
      });
    }

    if (req.method === "GET" && segments[0] === "match-participation" && segments[1] && segments[2]) {
      return withMiddleware(req, { action: "profile_get_match_participation" }, async ({ user, serviceClient }) => {
        const eventId = String(segments[1] || "").trim();
        const targetUserId = String(segments[2] || "").trim();
        const validStatuses = ["confirmed", "paid", "valid", "used"];

        assertCondition(eventId && targetUserId, "INVALID_PARAMS", "Parametros invalidos", 400);

        const { data: viewerParticipant, error: viewerError } = await serviceClient
          .from("event_participants")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", user!.id)
          .in("status", validStatuses)
          .maybeSingle();

        if (viewerError) throw new HttpError("MATCH_PARTICIPATION_FETCH_FAILED", viewerError.message, 400);
        if (!viewerParticipant) return { participation: null };

        const { data: viewerProfile, error: viewerProfileError } = await serviceClient
          .from("profiles")
          .select("match_enabled")
          .eq("id", user!.id)
          .maybeSingle();

        if (viewerProfileError) throw new HttpError("MATCH_PARTICIPATION_FETCH_FAILED", viewerProfileError.message, 400);
        if (!viewerProfile?.match_enabled) return { participation: null };

        const { data: targetParticipant, error } = await serviceClient
          .from("event_participants")
          .select("status")
          .eq("event_id", eventId)
          .eq("user_id", targetUserId)
          .in("status", validStatuses)
          .maybeSingle();

        if (error) throw new HttpError("MATCH_TARGET_PARTICIPATION_FETCH_FAILED", error.message, 400);
        if (!targetParticipant) return { participation: null };

        const { data: targetProfile, error: targetProfileError } = await serviceClient
          .from("profiles")
          .select("match_enabled")
          .eq("id", targetUserId)
          .maybeSingle();

        if (targetProfileError) throw new HttpError("MATCH_TARGET_PARTICIPATION_FETCH_FAILED", targetProfileError.message, 400);
        return {
          participation: {
            ...targetParticipant,
            match_enabled: targetProfile?.match_enabled ?? false,
          },
        };
      });
    }

    return errorResponse(req, new HttpError("NOT_FOUND", "Rota nao encontrada", 404));
  } catch (error) {
    return errorResponse(req, error);
  }
});
