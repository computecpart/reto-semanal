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
  "avatar-13",
  "avatar-14",
  "avatar-15",
  "avatar-16",
  "avatar-17",
  "avatar-18",
  "avatar-19",
  "avatar-20",
  "avatar-21",
  "avatar-22",
  "avatar-23",
  "avatar-24",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export interface AvatarOption {
  id: AvatarId;
  label: string;
  src: `/avatars/${AvatarId}.svg`;
}

const AVATAR_LABELS: Readonly<Record<AvatarId, string>> = {
  "avatar-01": "Zorro",
  "avatar-02": "Gato",
  "avatar-03": "Rana",
  "avatar-04": "Pingüino",
  "avatar-05": "Búho",
  "avatar-06": "Panda",
  "avatar-07": "Pulpo",
  "avatar-08": "Dragón",
  "avatar-09": "Zanahoria",
  "avatar-10": "Aguacate",
  "avatar-11": "Tomate",
  "avatar-12": "Brócoli",
  "avatar-13": "Hongo",
  "avatar-14": "Piña",
  "avatar-15": "Robot",
  "avatar-16": "Fantasma",
  "avatar-17": "Cohete",
  "avatar-18": "Taza de café",
  "avatar-19": "Cactus",
  "avatar-20": "Sandía",
  "avatar-21": "Abeja",
  "avatar-22": "Ballena",
  "avatar-23": "Control de juego",
  "avatar-24": "Pollito",
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
