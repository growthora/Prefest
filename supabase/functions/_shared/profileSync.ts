import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CheckoutProfileSnapshot {
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
}

const PROFILE_COLUMNS = ['full_name', 'email', 'cpf', 'phone', 'birth_date'] as const;
const BUYER_PROFILE_LOOKUP_COLUMNS = ['user_id'] as const;

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const digitsOnly = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

const normalizeDigits = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  if (!normalized) return null;

  const digits = digitsOnly(normalized);
  return digits.length > 0 ? digits : null;
};

const formatDateParts = (year: number, month: number, day: number) => {
  const normalizedYear = String(year).padStart(4, '0');
  const normalizedMonth = String(month).padStart(2, '0');
  const normalizedDay = String(day).padStart(2, '0');

  return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`;
};

const isValidDateParts = (year: number, month: number, day: number) => {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
};

const normalizeBirthDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, yearValue, monthValue, dayValue] = isoDateMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);

    return isValidDateParts(year, month, day)
      ? formatDateParts(year, month, day)
      : null;
  }

  const brDateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDateMatch) {
    const [, dayValue, monthValue, yearValue] = brDateMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);

    return isValidDateParts(year, month, day)
      ? formatDateParts(year, month, day)
      : null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatDateParts(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  );
};

const isMissingRelationError = (error: any) => String(error?.code || '') === '42P01';
const isMissingColumnError = (error: any) => String(error?.code || '') === '42703';
const isNotFoundError = (error: any) => String(error?.code || '') === 'PGRST116';
const isMissingConflictTargetError = (error: any) =>
  String(error?.code || '') === '42P10' ||
  String(error?.message || '').toLowerCase().includes('no unique or exclusion constraint matching the on conflict specification');

const extractMissingColumnName = (error: any): string | null => {
  const rawMessage = String(error?.message || error?.details || error?.hint || '');

  if (!rawMessage) {
    return null;
  }

  const patterns = [
    /column ["']?(?:public\.)?(?:\w+\.)?(\w+)["']? does not exist/i,
    /Could not find the ['"](\w+)['"] column/i,
    /schema cache.*['"](\w+)['"]/i,
  ];

  for (const pattern of patterns) {
    const match = rawMessage.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const removeColumn = (columns: readonly string[], columnName: string | null) =>
  columnName ? columns.filter((column) => column !== columnName) : [...columns];

async function selectSnapshot(
  adminClient: SupabaseClient,
  tableName: 'profiles' | 'buyer_profiles',
  keyColumn: 'id' | 'user_id',
  userId: string,
  columns: readonly string[],
  options: { optionalTable?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  let selectedColumns = [...columns];

  while (selectedColumns.length > 0) {
    const { data, error } = await adminClient
      .from(tableName)
      .select(selectedColumns.join(', '))
      .eq(keyColumn, userId)
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data;
    }

    if (isNotFoundError(error)) {
      return null;
    }

    if (options.optionalTable && isMissingRelationError(error)) {
      return null;
    }

    if (isMissingColumnError(error)) {
      const nextColumns = removeColumn(selectedColumns, extractMissingColumnName(error));

      if (nextColumns.length === selectedColumns.length) {
        throw error;
      }

      selectedColumns = nextColumns;
      continue;
    }

    throw error;
  }

  return null;
}

async function updateWithColumnFallback(
  adminClient: SupabaseClient,
  tableName: 'profiles' | 'buyer_profiles',
  keyColumn: 'id' | 'user_id',
  userId: string,
  payload: Record<string, unknown>,
) {
  const currentPayload = { ...payload };

  while (Object.keys(currentPayload).length > 0) {
    const { error } = await adminClient
      .from(tableName)
      .update(currentPayload)
      .eq(keyColumn, userId);

    if (!error) {
      return;
    }

    if (isMissingColumnError(error)) {
      const missingColumn = extractMissingColumnName(error);

      if (!missingColumn || !(missingColumn in currentPayload)) {
        throw error;
      }

      delete currentPayload[missingColumn];
      continue;
    }

    throw error;
  }
}

async function insertWithColumnFallback(
  adminClient: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const currentPayload = { ...payload };

  while (Object.keys(currentPayload).length > 0) {
    const { error } = await adminClient
      .from('buyer_profiles')
      .insert(currentPayload);

    if (!error) {
      return;
    }

    if (isMissingColumnError(error)) {
      const missingColumn = extractMissingColumnName(error);

      if (!missingColumn || !(missingColumn in currentPayload)) {
        throw error;
      }

      delete currentPayload[missingColumn];
      continue;
    }

    throw error;
  }
}

export const mergeProfileSnapshots = (
  profile: Partial<CheckoutProfileSnapshot> | null | undefined,
  buyerProfile: Partial<CheckoutProfileSnapshot> | null | undefined,
): CheckoutProfileSnapshot => ({
  full_name: normalizeString(profile?.full_name) ?? normalizeString(buyerProfile?.full_name),
  email: normalizeString(profile?.email) ?? normalizeString(buyerProfile?.email),
  cpf: normalizeDigits(profile?.cpf) ?? normalizeDigits(buyerProfile?.cpf),
  phone: normalizeDigits(profile?.phone) ?? normalizeDigits(buyerProfile?.phone),
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
  const profile = await selectSnapshot(
    adminClient,
    'profiles',
    'id',
    userId,
    PROFILE_COLUMNS,
  );

  const buyerProfile = await selectSnapshot(
    adminClient,
    'buyer_profiles',
    'user_id',
    userId,
    PROFILE_COLUMNS,
    { optionalTable: true },
  );

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
    cpf: updates.cpf === undefined ? undefined : normalizeDigits(updates.cpf),
    phone: updates.phone === undefined ? undefined : normalizeDigits(updates.phone),
    birth_date: updates.birth_date === undefined ? undefined : normalizeBirthDate(updates.birth_date),
  };

  const profileUpdates = Object.fromEntries(
    Object.entries(normalizedUpdates).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(profileUpdates).length > 0) {
    await updateWithColumnFallback(adminClient, 'profiles', 'id', userId, {
      ...profileUpdates,
      updated_at: new Date().toISOString(),
    });
  }

  const snapshot = await loadCheckoutProfileSnapshot(adminClient, userId);

  const buyerProfileLookup = await selectSnapshot(
    adminClient,
    'buyer_profiles',
    'user_id',
    userId,
    BUYER_PROFILE_LOOKUP_COLUMNS,
    { optionalTable: true },
  );

  if (buyerProfileLookup === null) {
    return snapshot;
  }

  const buyerProfilePayload = {
    user_id: userId,
    full_name: snapshot.full_name,
    email: snapshot.email,
    cpf: snapshot.cpf,
    phone: snapshot.phone,
    birth_date: snapshot.birth_date,
    updated_at: new Date().toISOString(),
  };

  try {
    if (buyerProfileLookup) {
      await updateWithColumnFallback(adminClient, 'buyer_profiles', 'user_id', userId, {
        full_name: snapshot.full_name,
        email: snapshot.email,
        cpf: snapshot.cpf,
        phone: snapshot.phone,
        birth_date: snapshot.birth_date,
        updated_at: new Date().toISOString(),
      });
    } else {
      await insertWithColumnFallback(adminClient, buyerProfilePayload);
    }
  } catch (error: any) {
    if (
      isMissingRelationError(error) ||
      isMissingColumnError(error) ||
      isMissingConflictTargetError(error)
    ) {
      return snapshot;
    }

    throw error;
  }

  return snapshot;
}
