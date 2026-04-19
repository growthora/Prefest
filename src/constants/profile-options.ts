export interface ProfileOption {
  value: string;
  label: string;
}

export const GENDER_IDENTITY_OPTIONS: readonly ProfileOption[] = [
  { value: 'homem_cis', label: 'Homem cis' },
  { value: 'mulher_cis', label: 'Mulher cis' },
  { value: 'homem_trans', label: 'Homem trans' },
  { value: 'mulher_trans', label: 'Mulher trans' },
  { value: 'nao_binario', label: 'Não binário' },
  { value: 'genero_fluido', label: 'Gênero fluido' },
  { value: 'agenero', label: 'Agênero' },
  { value: 'outro', label: 'Outro' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
] as const;

export const SEXUALITY_OPTIONS: readonly ProfileOption[] = [
  { value: 'heterossexual', label: 'Heterossexual' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbica', label: 'Lésbica' },
  { value: 'bissexual', label: 'Bissexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'assexual', label: 'Assexual' },
  { value: 'queer', label: 'Queer' },
  { value: 'outro', label: 'Outro' },
] as const;

export const RELATIONSHIP_STATUS_OPTIONS: readonly ProfileOption[] = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'namorando', label: 'Namorando' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'enrolado', label: 'Enrolado(a)' },
  { value: 'relacionamento_aberto', label: 'Relacionamento aberto' },
] as const;

export const MATCH_INTENTION_OPTIONS: readonly ProfileOption[] = [
  { value: 'paquera', label: 'Paquera / Date' },
  { value: 'amizade', label: 'Amizade' },
  { value: 'networking', label: 'Networking' },
  { value: 'casual', label: 'Algo casual' },
  { value: 'serio', label: 'Relacionamento sério' },
] as const;

export const MATCH_GENDER_PREFERENCE_OPTIONS: readonly ProfileOption[] = [
  { value: 'todos', label: 'Todos' },
] as const;

const createOptionLabelMap = (options: readonly ProfileOption[]) =>
  options.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {});

const GENDER_IDENTITY_LABELS = createOptionLabelMap(GENDER_IDENTITY_OPTIONS);
const SEXUALITY_LABELS = createOptionLabelMap(SEXUALITY_OPTIONS);
const RELATIONSHIP_STATUS_LABELS = createOptionLabelMap(RELATIONSHIP_STATUS_OPTIONS);
const MATCH_INTENTION_LABELS = createOptionLabelMap(MATCH_INTENTION_OPTIONS);
const MATCH_GENDER_PREFERENCE_LABELS = createOptionLabelMap([
  ...MATCH_GENDER_PREFERENCE_OPTIONS,
  ...GENDER_IDENTITY_OPTIONS,
]);

const humanizeProfileValue = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const getOptionLabel = (value: string | null | undefined, labels: Record<string, string>) => {
  if (!value) return null;
  return labels[value] ?? humanizeProfileValue(value);
};

export const getGenderIdentityLabel = (value: string | null | undefined) =>
  getOptionLabel(value, GENDER_IDENTITY_LABELS);

export const getSexualityLabel = (value: string | null | undefined) =>
  getOptionLabel(value, SEXUALITY_LABELS);

export const getRelationshipStatusLabel = (value: string | null | undefined) =>
  getOptionLabel(value, RELATIONSHIP_STATUS_LABELS);

export const getMatchIntentionLabel = (value: string | null | undefined) =>
  getOptionLabel(value, MATCH_INTENTION_LABELS);

export const getMatchGenderPreferenceLabel = (
  value: string | string[] | null | undefined,
) => {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    const normalizedValues = value.filter(Boolean);

    if (normalizedValues.includes('todos')) {
      return MATCH_GENDER_PREFERENCE_LABELS.todos;
    }

    return normalizedValues
      .map((item) => getOptionLabel(item, MATCH_GENDER_PREFERENCE_LABELS) ?? humanizeProfileValue(item))
      .join(', ');
  }

  return getOptionLabel(value, MATCH_GENDER_PREFERENCE_LABELS);
};
