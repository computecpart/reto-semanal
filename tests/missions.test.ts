import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getSafePostLoginPath } from "@/lib/auth/safe-redirect";
import { CODE_ALPHABET, formatCode, isValidCode, normalizeCode, parseScannedRedeemUrl, redeemUrl } from "@/lib/missions/schema";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022020000_missions.sql"), "utf8");
const ORIGIN = "https://piensads.app";

function body(name: string): string {
  const start = sql.indexOf(`function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("$$;", start));
}

describe("códigos de misión", () => {
  it("el alfabeto excluye caracteres ambiguos y coincide con el SQL", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
    expect(sql).toContain(`'${CODE_ALPHABET}'`);
  });

  it("normaliza mayúsculas, guiones y espacios", () => {
    expect(normalizeCode(" 7f38-z6dm ")).toBe("7F38Z6DM");
    expect(formatCode("7f38z6dm")).toBe("7F38-Z6DM");
    expect(isValidCode("7f38-z6dm")).toBe(true);
    expect(isValidCode("7F38-Z6D0")).toBe(false);
    expect(isValidCode("ABC")).toBe(false);
  });

  it("el QR solo contiene un enlace propio con el código", () => {
    expect(redeemUrl(ORIGIN, "7F38Z6DM")).toBe("https://piensads.app/app/canjear?c=7F38-Z6DM");
  });

  it("el escáner acepta solo enlaces propios a /app/canjear", () => {
    expect(parseScannedRedeemUrl(ORIGIN, "https://piensads.app/app/canjear?c=7F38-Z6DM")).toBe("7F38-Z6DM");
    expect(parseScannedRedeemUrl(ORIGIN, "https://evil.example/app/canjear?c=7F38-Z6DM")).toBeNull();
    expect(parseScannedRedeemUrl(ORIGIN, "https://piensads.app/login?c=7F38-Z6DM")).toBeNull();
    expect(parseScannedRedeemUrl(ORIGIN, "javascript:alert(1)")).toBeNull();
    expect(parseScannedRedeemUrl(ORIGIN, "7F38-Z6DM")).toBeNull();
  });

  it("el login solo vuelve a un enlace de canje bien formado", () => {
    expect(getSafePostLoginPath("/app/canjear?c=7F38-Z6DM")).toBe("/app/canjear?c=7F38-Z6DM");
    expect(getSafePostLoginPath("/app/canjear?c=7F38-Z6DM&x=//evil")).toBe("/app/perfil");
    expect(getSafePostLoginPath("//evil.example")).toBe("/app/perfil");
    expect(getSafePostLoginPath("/app/ranking")).toBe("/app/ranking");
  });
});

describe("seguridad de las misiones", () => {
  it("los códigos viven solo en el esquema privado", () => {
    expect(sql).toContain("create table private.reward_codes");
    expect(sql).toContain("revoke all on table private.reward_codes from public, anon, authenticated;");
    expect(sql).not.toMatch(/create table public\.\w+ \([^;]*\bcode text/);
  });

  it("una sola redención por persona y misión, sin escritura de clientes", () => {
    expect(sql).toContain("unique (user_id, reward_id)");
    expect(sql).not.toMatch(/grant (?:insert|update|delete|all)[^;]*public\.(?:rewards|reward_redemptions)/i);
  });

  it("el canje es atómico, idempotente y pasa por award_points", () => {
    const redeem = body("public.redeem_reward");

    expect(redeem).toContain("for update of rewards");
    expect(redeem).toContain("on conflict (user_id, reward_id) do nothing");
    expect(redeem).toContain("private.award_points(");
    expect(redeem).toContain("private.participant_can_earn(v_user_id)");
    expect(redeem).toContain("private.redeem_rate_limited(v_user_id)");
  });

  it("el generador usa bytes aleatorios sin sesgo", () => {
    const generator = body("private.new_reward_code");

    expect(generator).toContain("extensions.gen_random_bytes");
    expect(generator).toContain("v_byte < 248");
  });

  it("regenerar el código queda auditado", () => {
    expect(body("public.admin_regenerate_reward_code")).toContain("'reward.code_regenerate'");
  });
});
