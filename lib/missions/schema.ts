import { z } from "zod";

import { salvadorLocalToIso } from "@/lib/campaign/schemas";

// Same alphabet as private.new_reward_code (no 0/O, 1/I/L).
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_PATTERN = /^[2-9A-HJKMNP-Z]{8}$/;

export function normalizeCode(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function isValidCode(value: string): boolean {
  return CODE_PATTERN.test(normalizeCode(value));
}

/** Display format: XXXX-XXXX. */
export function formatCode(value: string): string {
  const code = normalizeCode(value);
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function redeemUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/app/canjear?c=${formatCode(code)}`;
}

/**
 * Accepts only links to this site's /app/canjear with a well-formed code.
 * Anything else read by the scanner is rejected and never opened.
 */
export function parseScannedRedeemUrl(origin: string, scanned: string): string | null {
  let url: URL;

  try {
    url = new URL(scanned.trim());
  } catch {
    return null;
  }

  if (url.origin !== origin || url.pathname !== "/app/canjear") {
    return null;
  }

  const code = url.searchParams.get("c") ?? "";
  return isValidCode(code) ? formatCode(code) : null;
}

const localDate = z.string().transform((value, context) => {
  const iso = salvadorLocalToIso(value.trim());

  if (!iso) {
    context.addIssue({ code: "custom", message: "Fecha y hora no válidas." });
    return z.NEVER;
  }

  return iso;
});

export const missionSchema = z
  .object({
    description: z.string().trim().max(1000, "Máximo 1000 caracteres."),
    enabled: z.boolean(),
    expiresAt: localDate,
    name: z.string().trim().min(3, "Mínimo 3 caracteres.").max(120, "Máximo 120 caracteres."),
    points: z.coerce.number().int("Usa un número entero.").min(1, "Mínimo 1 punto.").max(100000),
    startsAt: localDate,
  })
  .superRefine((mission, context) => {
    if (mission.expiresAt <= mission.startsAt) {
      context.addIssue({ code: "custom", message: "El vencimiento debe ser posterior al inicio.", path: ["expiresAt"] });
    }
  });

export interface MissionPreview {
  description: string;
  expires_at: string;
  name: string;
  points: number;
  starts_at: string;
  state: "available" | "redeemed" | "disabled" | "not_started" | "expired";
}
