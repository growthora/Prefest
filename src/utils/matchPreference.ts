import type { User } from '@/lib';

export type MatchGenderPreference = User['genderPreference'];

const LEGACY_GROUP_TO_CODES: Record<string, string[]> = {
  homens: ['homem_cis', 'homem_trans'],
  mulheres: ['mulher_cis', 'mulher_trans'],
  todos: ['todos'],
};

function normalizeValue(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeMatchGenderPreference(
  preference: MatchGenderPreference | string | string[] | null | undefined,
): string[] {
  if (!preference) return [];

  const rawValues = Array.isArray(preference) ? preference : [preference];
  const normalizedValues = rawValues
    .map((value) => normalizeValue(value))
    .flatMap((value) => {
      if (!value) return [];
      return LEGACY_GROUP_TO_CODES[value] ?? [value];
    });

  const uniqueValues = Array.from(new Set(normalizedValues));
  return uniqueValues.includes('todos') ? ['todos'] : uniqueValues;
}

export function toggleMatchGenderPreference(current: string[], value: string): string[] {
  const normalizedValue = normalizeValue(value);
  if (!normalizedValue) return current;

  if (normalizedValue === 'todos') {
    return ['todos'];
  }

  const nextValues = current.filter((item) => item !== 'todos');
  if (nextValues.includes(normalizedValue)) {
    return nextValues.filter((item) => item !== normalizedValue);
  }

  return [...nextValues, normalizedValue];
}

export function matchesGenderPreference(
  preference: MatchGenderPreference | string | string[] | null | undefined,
  candidateGenderIdentity: string | null | undefined,
): boolean {
  const normalizedPreference = normalizeMatchGenderPreference(preference);
  const normalizedIdentity = normalizeValue(candidateGenderIdentity);

  if (normalizedPreference.length === 0 || normalizedPreference.includes('todos')) {
    return true;
  }

  if (!normalizedIdentity) {
    return false;
  }

  return normalizedPreference.includes(normalizedIdentity);
}
