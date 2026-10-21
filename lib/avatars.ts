export const AVATAR_IDS = [
  "avatar-01",
  "avatar-02",
  "avatar-03",
  "avatar-04",
  "avatar-05",
  "avatar-06",
  "avatar-07",
  "avatar-08",
  "avatar-09",
  "avatar-10",
  "avatar-11",
  "avatar-12",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export interface AvatarOption {
  id: AvatarId;
  label: string;
  src: `/avatars/${AvatarId}.svg`;
}

const AVATAR_LABELS: Readonly<Record<AvatarId, string>> = {
  "avatar-01": "Brújula",
  "avatar-02": "Cometa",
  "avatar-03": "Lectora",
  "avatar-04": "Gorra naranja",
  "avatar-05": "Gorro morado",
  "avatar-06": "Rizos",
  "avatar-07": "Chispa",
  "avatar-08": "Cinta roja",
  "avatar-09": "Robot",
  "avatar-10": "Girasol",
  "avatar-11": "Maestro",
  "avatar-12": "Visitante",
};

export const AVATARS: readonly AvatarOption[] = AVATAR_IDS.map((id) => ({
  id,
  label: AVATAR_LABELS[id],
  src: `/avatars/${id}.svg`,
}));

export function getAvatar(id: unknown): AvatarOption | undefined {
  return AVATARS.find((avatar) => avatar.id === id);
}

export function isAvatarId(value: unknown): value is AvatarId {
  return (
    typeof value === "string" &&
    AVATAR_IDS.some((candidate) => candidate === value)
  );
}
