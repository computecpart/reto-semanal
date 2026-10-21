import { describe, expect, it } from "vitest";

import { parsePublicSupabaseEnv } from "@/lib/validation/env";

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
};

describe("parsePublicSupabaseEnv", () => {
  it("acepta una configuración pública válida", () => {
    expect(parsePublicSupabaseEnv(validEnvironment)).toEqual(validEnvironment);
  });

  it("acepta la URL HTTP del entorno local", () => {
    expect(
      parsePublicSupabaseEnv({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }).NEXT_PUBLIC_SUPABASE_URL,
    ).toBe("http://127.0.0.1:54321");
  });

  it("rechaza variables requeridas ausentes", () => {
    expect(() =>
      parsePublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: validEnvironment.NEXT_PUBLIC_SUPABASE_URL,
      }),
    ).toThrow(/configuración pública/i);
  });

  it("rechaza una URL inválida", () => {
    expect(() =>
      parsePublicSupabaseEnv({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: "no-es-una-url",
      }),
    ).toThrow(/configuración pública/i);
  });

  it("rechaza una secret key moderna en el campo publishable", () => {
    expect(() =>
      parsePublicSupabaseEnv({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example",
      }),
    ).toThrow(/configuración pública/i);
  });

  it("rechaza una service role key heredada en formato JWT", () => {
    const payload = Buffer.from(
      JSON.stringify({ role: "service_role" }),
    ).toString("base64url");

    expect(() =>
      parsePublicSupabaseEnv({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `header.${payload}.signature`,
      }),
    ).toThrow(/configuración pública/i);
  });

  it("rechaza nombres públicos destinados a secretos", () => {
    expect(() =>
      parsePublicSupabaseEnv({
        ...validEnvironment,
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "never-public",
      }),
    ).toThrow(/no puede contener secretos/i);
  });
});
