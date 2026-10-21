import { z } from "zod";

export const RANKING_AUDIENCES = ["public", "authenticated"] as const;
export const RANKING_IDENTITIES = ["alias", "alias_passport", "alias_name", "name"] as const;

export type RankingAudience = (typeof RANKING_AUDIENCES)[number];
export type RankingIdentity = (typeof RANKING_IDENTITIES)[number];

export const RANKING_AUDIENCE_LABELS: Readonly<Record<RankingAudience, string>> = {
  authenticated: "Solo participantes con sesión",
  public: "Público (también en la portada)",
};

export const RANKING_IDENTITY_LABELS: Readonly<Record<RankingIdentity, string>> = {
  alias: "Solo alias",
  alias_name: "Alias + nombre (inicial del apellido)",
  alias_passport: "Alias + identificador parcial (recomendado)",
  name: "Nombre (inicial del apellido)",
};

export const POINT_KIND_LABELS: Readonly<Record<string, string>> = {
  adjustment: "Ajuste",
  correction: "Corrección",
  mission: "Misión",
  open_review: "Respuesta abierta",
  quiz: "Trivia",
  quiz_speed_bonus: "Bono de velocidad",
};

export const rankingSettingsSchema = z.object({
  audience: z.enum(RANKING_AUDIENCES),
  highlightTop: z.coerce.number().int().min(0, "Mínimo 0.").max(20, "Máximo 20."),
  identity: z.enum(RANKING_IDENTITIES),
  visible: z.boolean(),
});

export const pointAdjustmentSchema = z.object({
  amount: z.coerce
    .number()
    .int("Usa un número entero.")
    .refine((value) => value !== 0, "El ajuste no puede ser 0.")
    .refine((value) => Math.abs(value) <= 100000, "Máximo 100 000 puntos."),
  description: z.string().trim().max(200, "Máximo 200 caracteres."),
  reason: z.string().trim().min(10, "Describe el motivo con al menos 10 caracteres.").max(500),
  userId: z.uuid("Selecciona un participante."),
});

export const pointReversalSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(10, "Describe el motivo con al menos 10 caracteres.").max(500),
});

/** Formats a signed point amount for display: "+25", "−10". */
export function formatPoints(amount: number): string {
  const formatted = new Intl.NumberFormat("es-SV").format(Math.abs(amount));
  return amount > 0 ? `+${formatted}` : amount < 0 ? `−${formatted}` : formatted;
}

/** True when the row shares its standing with a neighbour (a tie). */
export function isTie<T extends { standing: number }>(rows: readonly T[], index: number): boolean {
  const current = rows[index];

  if (!current) {
    return false;
  }

  return rows[index - 1]?.standing === current.standing || rows[index + 1]?.standing === current.standing;
}
