const INVALID_MATCH_PHOTO_VALUES = new Set(['', 'null', 'undefined']);
const MATCH_PHOTO_PLACEHOLDER_HOSTS = ['ui-avatars.com', 'api.dicebear.com'];
const matchPhotoAvailabilityCache = new Map<string, Promise<boolean>>();

export const MATCH_PHOTO_REQUIRED_MESSAGE = 'Adicione uma foto de perfil para começar a dar match';

export function normalizeMatchPhoto(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isFallbackMatchPhoto(value?: string | null): boolean {
  const normalizedPhoto = normalizeMatchPhoto(value).toLowerCase();

  if (!normalizedPhoto) {
    return false;
  }

  return MATCH_PHOTO_PLACEHOLDER_HOSTS.some((host) => normalizedPhoto.includes(host));
}

export function hasValidMatchPhoto(value?: string | null): boolean {
  const normalizedPhoto = normalizeMatchPhoto(value);
  const normalizedLowerPhoto = normalizedPhoto.toLowerCase();

  if (INVALID_MATCH_PHOTO_VALUES.has(normalizedLowerPhoto)) {
    return false;
  }

  if (isFallbackMatchPhoto(normalizedPhoto)) {
    return false;
  }

  if (normalizedLowerPhoto.startsWith('blob:') || normalizedLowerPhoto.startsWith('data:image/')) {
    return true;
  }

  if (normalizedLowerPhoto.startsWith('http://') || normalizedLowerPhoto.startsWith('https://')) {
    try {
      return Boolean(new URL(normalizedPhoto).hostname);
    } catch {
      return false;
    }
  }

  return /^[^\s]+\/[^\s]+$/.test(normalizedPhoto);
}

export async function hasRenderableMatchPhoto(value?: string | null): Promise<boolean> {
  const normalizedPhoto = normalizeMatchPhoto(value);

  if (!hasValidMatchPhoto(normalizedPhoto)) {
    return false;
  }

  if (typeof window === 'undefined') {
    return true;
  }

  const cachedResult = matchPhotoAvailabilityCache.get(normalizedPhoto);
  if (cachedResult) {
    return cachedResult;
  }

  const validationPromise = new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;

    const finalize = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    image.onload = () => finalize(true);
    image.onerror = () => finalize(false);
    image.src = normalizedPhoto;

    if (image.complete && image.naturalWidth > 0) {
      finalize(true);
    }
  });

  matchPhotoAvailabilityCache.set(normalizedPhoto, validationPromise);
  return validationPromise;
}

export async function filterItemsWithRenderableMatchPhoto<T>(
  items: T[],
  getPhoto: (item: T) => string | null | undefined
): Promise<T[]> {
  const validationResults = await Promise.all(
    items.map(async (item) => ({
      item,
      isValid: await hasRenderableMatchPhoto(getPhoto(item)),
    }))
  );

  return validationResults.filter((entry) => entry.isValid).map((entry) => entry.item);
}
