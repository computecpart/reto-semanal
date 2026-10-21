import { z } from "zod";

import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

import { CAMPAIGN_SLUG_PATTERN, CAMPAIGN_STATUSES } from "./status";

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Converts a `datetime-local` value interpreted in America/El_Salvador
 * (UTC-6, no daylight saving) into an ISO instant.
 */
export function salvadorLocalToIso(value: string): string | null {
  const match = LOCAL_DATETIME.exec(value);

  if (!match) {
    return null;
  }

  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Reject impossible values such as 2026-02-31 that Date would roll over.
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour + 6, minute)).toISOString();
}

/** Formats an instant as the `datetime-local` value in El Salvador time. */
export function isoToSalvadorLocal(value: string | null): string {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

const optionalLocalDate = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") {
      return null;
    }

    const iso = salvadorLocalToIso(value);

    if (!iso) {
      context.addIssue({ code: "custom", message: "Fecha y hora no válidas." });
      return z.NEVER;
    }

    return iso;
  });

export const campaignIdentitySchema = z.object({
  name: z.string().trim().min(3, "Mínimo 3 caracteres.").max(120, "Máximo 120 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Mínimo 3 caracteres.")
    .max(60, "Máximo 60 caracteres.")
    .regex(CAMPAIGN_SLUG_PATTERN, "Usa minúsculas, números y guiones."),
});

export const campaignDetailsSchema = campaignIdentitySchema
  .extend({
    endsAt: optionalLocalDate,
    prizeDescription: z.string().trim().max(2000, "Máximo 2000 caracteres."),
    prizeTitle: z.string().trim().max(160, "Máximo 160 caracteres."),
    startsAt: optionalLocalDate,
  })
  .superRefine((data, context) => {
    if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
      context.addIssue({
        code: "custom",
        message: "El cierre debe ser posterior al inicio.",
        path: ["endsAt"],
      });
    }
  });

export const campaignStatusChangeSchema = z.object({
  reason: z.string().trim().max(500, "Máximo 500 caracteres."),
  status: z.enum(CAMPAIGN_STATUSES),
});

export const rulesPublishSchema = z.object({
  changeSummary: z.string().trim().max(500, "Máximo 500 caracteres."),
  contentMd: z
    .string()
    .trim()
    .min(20, "Las reglas son demasiado cortas.")
    .max(50000, "Máximo 50 000 caracteres."),
  isMajor: z.boolean(),
});
