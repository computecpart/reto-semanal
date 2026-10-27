// Client-side password guidance. Supabase Auth (HaveIBeenPwned ON) stays the
// authority; these checks only explain the rejection before the request.

const COMMON = [
  "password",
  "contrasena",
  "contraseña",
  "qwerty",
  "asdfgh",
  "zxcvbn",
  "iloveyou",
  "teamo",
  "admin",
  "welcome",
  "bienvenido",
  "dragon",
  "msi",
  "passport",
  "pasaporte",
  "piensads",
  "digital",
  "solutions",
  "elsalvador",
  "salvador",
  "football",
  "futbol",
  "monkey",
  "letmein",
  "abc",
];

const SEQUENCES = ["0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export interface PasswordContext {
  alias?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** True when the password is just a run of a keyboard or digit sequence (e.g. 12345678, qwertyui). */
function isSequence(value: string): boolean {
  const lower = normalize(value);
  return SEQUENCES.some((sequence) => sequence.includes(lower) || [...sequence].reverse().join("").includes(lower));
}

/**
 * Explains why a password is weak, or returns null. Mirrors what usually ends
 * up in breach lists: sequences, repetitions, common words with a few digits
 * and personal data.
 */
export function localPasswordIssue(password: string, context: PasswordContext = {}): string | null {
  const lower = normalize(password);
  // Strip trailing/leading digits and symbols: "dragon2026!" behaves like "dragon".
  const core = lower.replace(/^[^a-z]+|[^a-z]+$/g, "");

  if (/^(.)\1+$/.test(lower)) {
    return "No uses un mismo carácter repetido.";
  }

  if (/^\d+$/.test(lower) || isSequence(lower)) {
    return "No uses solo números ni secuencias como 12345678 o qwerty.";
  }

  if (core.length > 0 && COMMON.some((word) => core === word || core === `${word}${word}`)) {
    return "Es una palabra muy común; aunque le agregues números, aparece en filtraciones.";
  }

  const personal = [context.alias, context.firstName, context.lastName, context.email?.split("@")[0]]
    .map((value) => normalize(value ?? "").trim())
    .filter((value) => value.length >= 4);

  if (personal.some((value) => lower.includes(value))) {
    return "No incluyas tu nombre, alias ni correo en la contraseña.";
  }

  return null;
}

/** Live checklist shown under the field. */
export function passwordChecklist(password: string): { label: string; ok: boolean }[] {
  return [
    { label: "Al menos 8 caracteres (mejor 12 o más)", ok: password.length >= 8 },
    { label: "Mezcla letras con números o símbolos", ok: /[a-z]/i.test(password) && /[^a-z]/i.test(password) },
    { label: "No es una secuencia ni una palabra común", ok: password.length > 0 && localPasswordIssue(password) === null },
  ];
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * k-anonymity lookup in the Pwned Passwords range API: only the first five
 * characters of the SHA-1 hash leave the browser. Returns null when the
 * service cannot be reached (Supabase still checks on submit).
 */
export async function isPwnedPassword(password: string, fetcher: typeof fetch = fetch): Promise<boolean | null> {
  try {
    const hash = await sha1Hex(password);
    const response = await fetcher(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { "Add-Padding": "true" },
    });

    if (!response.ok) {
      return null;
    }

    const suffix = hash.slice(5);
    const body = await response.text();

    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return null;
  }
}

export const PWNED_MESSAGE =
  "Esta contraseña aparece en filtraciones públicas y no se acepta. Prueba uniendo tres palabras sin relación y un número o símbolo.";
