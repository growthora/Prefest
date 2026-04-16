type IdentifiableItem = {
  id?: string | number | null;
  title?: string | null;
  name?: string | null;
};

const normalizeItemId = (item: IdentifiableItem, index: number) =>
  item.id !== null && item.id !== undefined && String(item.id).trim() !== ''
    ? String(item.id)
    : `missing-id-${index}`;

export function removeDuplicates<T extends IdentifiableItem>(items: T[]): T[] {
  return [...new Map(items.map((item, index) => [normalizeItemId(item, index), item])).values()];
}

export function getStableEventKey(item: IdentifiableItem): string {
  const rawId =
    item.id !== null && item.id !== undefined && String(item.id).trim() !== ''
      ? String(item.id)
      : item.title || item.name || 'sem-id';

  return `evento-${rawId}`;
}

export function logDuplicateItems(scope: string, items: IdentifiableItem[]): void {
  if (!import.meta.env.DEV) return;

  console.log(`[${scope}] listaEventos`, items);

  const occurrences = items.reduce<Map<string, number>>((acc, item, index) => {
    const id = normalizeItemId(item, index);
    acc.set(id, (acc.get(id) || 0) + 1);
    return acc;
  }, new Map());

  const duplicateIds = [...occurrences.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  if (duplicateIds.length > 0) {
    console.warn(`[${scope}] eventos duplicados detectados`, duplicateIds);
  }
}
