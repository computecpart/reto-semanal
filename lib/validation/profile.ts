import { z } from "zod";

import { AVATAR_IDS, isAvatarId, type AvatarId } from "@/lib/avatars";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const EL_SALVADOR_DEPARTMENTS = [
  "Ahuachapán",
  "Cabañas",
  "Chalatenango",
  "Cuscatlán",
  "La Libertad",
  "La Paz",
  "La Unión",
  "Morazán",
  "San Miguel",
  "San Salvador",
  "San Vicente",
  "Santa Ana",
  "Sonsonate",
  "Usulután",
] as const;

export type Department = (typeof EL_SALVADOR_DEPARTMENTS)[number];

export const AGE_DECLARATIONS = ["adult", "minor"] as const;

export type AgeDeclaration = (typeof AGE_DECLARATIONS)[number];

export const AGE_OF_MAJORITY = 18;
export const MAXIMUM_REGISTRATION_AGE = 120;

export const RESERVED_ALIAS_TERMS = [
  "admin",
  "administrador",
  "administrator",
  "superadmin",
  "support",
  "soporte",
  "staff",
  "oficial",
  "official",
  "moderador",
  "moderator",
] as const;

const BLOCKED_ALIAS_TERMS = new Set([
  "cerote",
  "cerotes",
  "culera",
  "culero",
  "fuck",
  "fucker",
  "mierda",
  "mierdas",
  "nazi",
  "pendeja",
  "pendejo",
  "puta",
  "putas",
  "puto",
  "putos",
  "shit",
  "verga",
  "vergas",
]);

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERSON_NAME_PATTERN = /^\p{L}(?:[\p{L}\p{M}'’ -]*\p{L})?$/u;
const ALIAS_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const HTML_LIKE_PATTERN =
  /[<>]|&(?:lt|gt|#0*60|#0*62|#x0*3c|#x0*3e);/i;
const URL_LIKE_PATTERN =
  /(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|edu|gov|gob|io|co|sv)(?:[/?#:]|$))/i;

interface DateParts {
  day: number;
  month: number;
  year: number;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const lengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ] as const;

  return lengths[month - 1] ?? 0;
}

export function parseDateOnly(value: string): DateParts | null {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return { day, month, year };
}

function formatDateOnly({ day, month, year }: DateParts): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function compareDateOnly(left: string, right: string): number {
  return left.localeCompare(right);
}

// Same semantics as PostgreSQL `date + interval 'N years'`: Feb 29 clamps
// to Feb 28 in non-leap years. Client and database must agree on ages.
function shiftYears(value: string, years: number): string {
  const parts = parseDateOnly(value);

  if (!parts) {
    throw new TypeError("Se requiere una fecha ISO válida.");
  }

  const year = parts.year + years;
  const day = Math.min(parts.day, daysInMonth(year, parts.month));

  return formatDateOnly({ day, month: parts.month, year });
}

export function getOperationalDate(now: Date): string {
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("Se requiere un instante válido.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  const day = part("day");
  const month = part("month");
  const year = part("year");

  if (!day || !month || !year) {
    throw new Error("No fue posible obtener la fecha operacional.");
  }

  return `${year}-${month}-${day}`;
}

export function isAdultOn(
  birthDate: string,
  operationalDate: string,
): boolean {
  if (!parseDateOnly(birthDate) || !parseDateOnly(operationalDate)) {
    return false;
  }

  const eighteenthBirthday = shiftYears(birthDate, AGE_OF_MAJORITY);

  return compareDateOnly(eighteenthBirthday, operationalDate) <= 0;
}

export function normalizePersonName(value: string): string {
  return value.normalize("NFKC").trim().replace(/ {2,}/g, " ");
}

export function normalizeAlias(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\p{White_Space}+/gu, "-");
}

export function containsUrlOrHtml(value: string): boolean {
  const normalized = value.normalize("NFKC");

  return HTML_LIKE_PATTERN.test(normalized) || URL_LIKE_PATTERN.test(normalized);
}

function aliasScreeningForms(value: string): readonly string[] {
  const normalized = normalizeAlias(value);
  const leetFolded = normalized
    .replaceAll("0", "o")
    .replaceAll("1", "i")
    .replaceAll("3", "e")
    .replaceAll("4", "a")
    .replaceAll("5", "s")
    .replaceAll("7", "t")
    .replaceAll("8", "b")
    .replaceAll("9", "g");
  const tokens = leetFolded.split(/[-_]+/).filter(Boolean);

  return [leetFolded.replace(/[-_]/g, ""), ...tokens];
}

export function isReservedAlias(value: string): boolean {
  const reserved = new Set<string>(RESERVED_ALIAS_TERMS);

  return aliasScreeningForms(value).some((candidate) =>
    reserved.has(candidate.replace(/\d+/g, "")),
  );
}

export function containsBlockedAliasTerm(value: string): boolean {
  return aliasScreeningForms(value).some((candidate) =>
    BLOCKED_ALIAS_TERMS.has(candidate),
  );
}

export const personNameSchema = z
  .string()
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
    message: "El nombre contiene caracteres no permitidos.",
  })
  .transform(normalizePersonName)
  .pipe(
    z
      .string()
      .min(1, "Este campo es obligatorio.")
      .max(80, "Debe tener como máximo 80 caracteres.")
      .regex(PERSON_NAME_PATTERN, "El nombre contiene caracteres no permitidos."),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.")
  .email("Introduce un correo electrónico válido.");

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128, "La contraseña debe tener como máximo 128 caracteres.");

export const aliasSchema = z
  .string()
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
    message: "El alias contiene caracteres no permitidos.",
  })
  .refine((value) => !containsUrlOrHtml(value), {
    message: "El alias no puede contener URLs ni HTML.",
  })
  .transform(normalizeAlias)
  .pipe(
    z
      .string()
      .min(3, "El alias debe tener al menos 3 caracteres.")
      .max(24, "El alias debe tener como máximo 24 caracteres.")
      .regex(
        ALIAS_PATTERN,
        "Usa únicamente letras, números, guiones y guiones bajos.",
      ),
  )
  .refine((value) => !isReservedAlias(value), {
    message: "Este alias utiliza un término reservado.",
  })
  .refine((value) => !containsBlockedAliasTerm(value), {
    message: "Este alias no está permitido.",
  });

export const birthDateSchema = z.string().refine(parseDateOnly, {
  message: "Introduce una fecha válida en formato YYYY-MM-DD.",
});

export const departmentSchema = z
  .string()
  .transform((value) => value.normalize("NFC"))
  .pipe(z.enum(EL_SALVADOR_DEPARTMENTS));

export const avatarIdSchema = z.custom<AvatarId>(isAvatarId, {
  message: "Selecciona un avatar válido.",
});

export const ageDeclarationSchema = z.enum(AGE_DECLARATIONS);

function assertOperationalDate(value: string): void {
  if (!parseDateOnly(value)) {
    throw new TypeError("La fecha operacional debe usar el formato YYYY-MM-DD.");
  }
}

function addAgeIssues(
  data: { ageDeclaration: AgeDeclaration; birthDate: string },
  operationalDate: string,
  context: z.RefinementCtx,
): void {
  if (compareDateOnly(data.birthDate, operationalDate) > 0) {
    context.addIssue({
      code: "custom",
      message: "La fecha de nacimiento no puede estar en el futuro.",
      path: ["birthDate"],
    });
  }

  const oldestAllowedDate = shiftYears(
    operationalDate,
    -MAXIMUM_REGISTRATION_AGE,
  );

  if (compareDateOnly(data.birthDate, oldestAllowedDate) < 0) {
    context.addIssue({
      code: "custom",
      message: `La edad no puede superar ${MAXIMUM_REGISTRATION_AGE} años.`,
      path: ["birthDate"],
    });
  }

  const declaredAdult = data.ageDeclaration === "adult";

  if (declaredAdult !== isAdultOn(data.birthDate, operationalDate)) {
    context.addIssue({
      code: "custom",
      message:
        "La declaración de edad no coincide con la fecha de nacimiento.",
      path: ["ageDeclaration"],
    });
  }
}

const consentFields = {
  acceptedPrivacy: z.literal(true, {
    error: "Debes aceptar la política de privacidad.",
  }),
  acceptedRules: z.literal(true, {
    error: "Debes aceptar las reglas.",
  }),
};

const editableProfileFields = {
  alias: aliasSchema,
  avatarId: avatarIdSchema,
  department: departmentSchema,
  firstName: personNameSchema,
  lastName: personNameSchema,
};

export function createRegistrationSchema(operationalDate: string) {
  assertOperationalDate(operationalDate);

  return z
    .strictObject({
      ...consentFields,
      ...editableProfileFields,
      ageDeclaration: ageDeclarationSchema,
      birthDate: birthDateSchema,
      confirmPassword: z.string(),
      email: emailSchema,
      password: passwordSchema,
    })
    .superRefine((data, context) => {
      if (data.password !== data.confirmPassword) {
        context.addIssue({
          code: "custom",
          message: "Las contraseñas no coinciden.",
          path: ["confirmPassword"],
        });
      }

      addAgeIssues(data, operationalDate, context);
    })
    .transform(({ confirmPassword: _confirmPassword, ...data }) => data);
}

export type RegistrationInput = z.input<
  ReturnType<typeof createRegistrationSchema>
>;
export type RegistrationData = z.output<
  ReturnType<typeof createRegistrationSchema>
>;

/**
 * Completes a profile that predates registration metadata (accounts backfilled
 * by the foundation migration). New registrations never need it.
 */
export function createProfileCompletionSchema(operationalDate: string) {
  assertOperationalDate(operationalDate);

  return z
    .strictObject({
      ...consentFields,
      ...editableProfileFields,
      ageDeclaration: ageDeclarationSchema,
      birthDate: birthDateSchema,
    })
    .superRefine((data, context) => {
      addAgeIssues(data, operationalDate, context);
    });
}

export type ProfileCompletionData = z.output<
  ReturnType<typeof createProfileCompletionSchema>
>;

/**
 * Only these fields are editable after registration. Role, points,
 * disciplinary status, birth date and consents are deliberately absent.
 */
export const profileUpdateSchema = z.strictObject(editableProfileFields);

export type ProfileUpdateData = z.output<typeof profileUpdateSchema>;

// Keep the tuple import live and type-checked against the public avatar schema.
void AVATAR_IDS;
