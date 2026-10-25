import type { AvatarConfig } from '../types';
export const AVATAR_MODELS: Record<
  'male' | 'female',
  ReadonlyArray<{ id: AvatarConfig['hair']; label: string; description: string; preview: string }>
>;
export const AVATAR_HAIRS: ReadonlyArray<AvatarConfig['hair']>;
export function selectAvatarCharacter(
  avatar: AvatarConfig,
  character: 'male' | 'female',
): AvatarConfig;
