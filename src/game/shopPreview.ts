import type { AvatarConfig, StoreItem } from '../types';

export type FittingSelection = Partial<Record<StoreItem['category'], string>>;

/** Local-only overrides. The persisted avatar always remains the source of the base look. */
export function fittingAvatar(saved: AvatarConfig, selection: FittingSelection): AvatarConfig {
  return { ...saved, ...selection };
}

export function clearFittingSlot(
  selection: FittingSelection,
  slot: StoreItem['category'],
): FittingSelection {
  const next = { ...selection };
  delete next[slot];
  return next;
}

export function toggleFittingItem(
  selection: FittingSelection,
  item: Pick<StoreItem, 'id' | 'category'>,
): FittingSelection {
  return selection[item.category] === item.id
    ? clearFittingSlot(selection, item.category)
    : { ...selection, [item.category]: item.id };
}
