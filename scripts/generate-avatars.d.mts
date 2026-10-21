export interface AvatarSpec {
  id: string;
  [key: string]: unknown;
}

export const AVATAR_SPECS: readonly AvatarSpec[];

export function renderAvatarPixels(spec: AvatarSpec): (string | null)[][];

export function renderAvatarSvg(spec: AvatarSpec): string;
