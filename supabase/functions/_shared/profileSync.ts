import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CheckoutProfileSnapshot {
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
}

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBirthDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return trimmed;
};

const digitsOnly = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

const isMissingRelationError = (error: any) => String(error?.code || '') === '42P01';
const isMissingColumnError = (error: any) => String(error?.code || '') === '42703';
const isNotFoundError = (error: any) => String(error?.code || '') === 'PGRST116';

export const mergeProfileSnapshots = (
  profile: Partial<CheckoutProfileSnapshot> | null | undefined,
  buyerProfile: Partial<CheckoutProfileSnapshot> | null | undefined,
): CheckoutProfileSnapshot => ({
  full_name: normalizeString(profile?.full_name) ?? normalizeString(buyerProfile?.full_name),
  email: normalizeString(profile?.email) ?? normalizeString(buyerProfile?.email),
  cpf: normalizeString(profile?.cpf) ?? normalizeString(buyerProfile?.cpf),
  phone: normalizeString(profile?.phone) ?? normalizeString(buyerProfile?.phone),
  birth_date: normalizeBirthDate(profile?.birth_date) ?? normalizeBirthDate(buyerProfile?.birth_date),
});

export const getMissingProfileFields = (snapshot: CheckoutProfileSnapshot): string[] => {
  const missing: string[] = [];

  if (!normalizeString(snapshot.full_name)) {
    missing.push('full_name');
  }

  const cpfDigits = digitsOnly(snapshot.cpf);
  if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
    missing.push('cpf');
  }

  const phoneDigits = digitsOnly(snapshot.phone);
  if (phoneDigits.length < 10) {
    missing.push('phone');
  }

  if (!normalizeBirthDate(snapshot.birth_date)) {
    missing.push('birth_date');
  }

  return missing;
};

export const isProfileComplete = (snapshot: CheckoutProfileSnapshot) =>
  getMissingProfileFields(snapshot).length === 0;

export async function loadCheckoutProfileSnapshot(
  adminClient: SupabaseClient,
  userId: string,
): Promise<CheckoutProfileSnapshot> {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('full_name, email, cpf, phone, birth_date')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && !isNotFoundError(profileError)) {
    throw profileError;
  }

  let buyerProfile: Partial<CheckoutProfileSnapshot> | null = null;
  const buyerProfileResult = await adminClient
    .from('buyer_profiles')
    .select('full_name, email, cpf, phone, birth_date')
    .eq('user_id', userId)
    .maybeSingle();

  if (!buyerProfileResult.error) {
    buyerProfile = buyerProfileResult.data;
  } else if (isMissingColumnError(buyerProfileResult.error)) {
    const legacyBuyerProfileResult = await adminClient
      .from('buyer_profiles')
      .select('full_name, email, cpf, phone')
      .eq('user_id', userId)
      .maybeSingle();

    if (!legacyBuyerProfileResult.error) {
      buyerProfile = legacyBuyerProfileResult.data;
    } else if (!isMissingRelationError(legacyBuyerProfileResult.error) && !isNotFoundError(legacyBuyerProfileResult.error)) {
      throw legacyBuyerProfileResult.error;
    }
  } else if (!isMissingRelationError(buyerProfileResult.error) && !isNotFoundError(buyerProfileResult.error)) {
    throw buyerProfileResult.error;
  }

  return mergeProfileSnapshots(profile, buyerProfile);
}

export async function syncCheckoutProfileSnapshot(
  adminClient: SupabaseClient,
  userId: string,
  updates: Partial<CheckoutProfileSnapshot>,
): Promise<CheckoutProfileSnapshot> {
  const normalizedUpdates: Partial<CheckoutProfileSnapshot> = {
    full_name: updates.full_name === undefined ? undefined : normalizeString(updates.full_name),
    email: updates.email === undefined ? undefined : normalizeString(updates.email),
    cpf: updates.cpf === undefined ? undefined : normalizeString(updates.cpf),
    phone: updates.phone === undefined ? undefined : normalizeString(updates.phone),
    birth_date: updates.birth_date === undefined ? undefined : normalizeBirthDate(updates.birth_date),
  };

  const profileUpdates = Object.fromEntries(
    Object.entries(normalizedUpdates).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateProfileError } = await adminClient
      .from('profiles')
      .update({
        ...profileUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateProfileError) {
      throw updateProfileError;
    }
  }

  const snapshot = await loadCheckoutProfileSnapshot(adminClient, userId);
  const buyerProfilePayload = {
    user_id: userId,
    full_name: snapshot.full_name,
    email: snapshot.email,
    cpf: snapshot.cpf,
    phone: snapshot.phone,
    updated_at: new Date().toISOString(),
  };

  const upsertWithBirthDate = {
    ...buyerProfilePayload,
    birth_date: snapshot.birth_date,
  };

  const firstAttempt = await adminClient
    .from('buyer_profiles')
    .upsert(upsertWithBirthDate, { onConflict: 'user_id' });

  if (firstAttempt.error) {
    if (isMissingRelationError(firstAttempt.error)) {
      return snapshot;
    }

    if (isMissingColumnError(firstAttempt.error)) {
      const retry = await adminClient
        .from('buyer_profiles')
        .upsert(buyerProfilePayload, { onConflict: 'user_id' });

      if (retry.error && !isMissingRelationError(retry.error)) {
        throw retry.error;
      }

      return snapshot;
    }

    throw firstAttempt.error;
  }

  return snapshot;
}
