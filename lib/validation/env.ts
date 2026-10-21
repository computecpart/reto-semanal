import { z } from "zod";

const forbiddenPublicVariable = /^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/i;

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isPrivilegedSupabaseKey(value: string): boolean {
  if (/^sb_secret_/i.test(value)) {
    return true;
  }

  const payload = value.split(".")[1];

  if (!payload) {
    return false;
  }

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalizedPayload.length % 4)) % 4);
    const claims = JSON.parse(
      globalThis.atob(`${normalizedPayload}${padding}`),
    ) as { role?: unknown };

    return claims.role === "service_role";
  } catch {
    return false;
  }
}

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !isPrivilegedSupabaseKey(value)),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .refine(isHttpUrl),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

export function parsePublicSupabaseEnv(
  environment: Readonly<Record<string, unknown>>,
): PublicSupabaseEnv {
  const forbiddenVariable = Object.keys(environment).find((name) =>
    forbiddenPublicVariable.test(name),
  );

  if (forbiddenVariable) {
    throw new Error("Una variable pública no puede contener secretos de Supabase.");
  }

  const result = publicSupabaseEnvSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(
      "La configuración pública de Supabase falta o contiene valores inválidos.",
    );
  }

  return result.data;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return parsePublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
