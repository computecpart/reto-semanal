import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AVATAR_IDS, AVATARS, isAvatarId } from "@/lib/avatars";
import { AVATAR_SPECS, renderAvatarSvg } from "@/scripts/generate-avatars.mjs";

describe("avatares", () => {
  it("ofrece 24 avatares variados con nombre único", () => {
    expect(AVATARS).toHaveLength(24);
    expect(new Set(AVATARS.map((avatar) => avatar.label)).size).toBe(AVATARS.length);
  });

  it("tiene un SVG publicado y actualizado para cada id", () => {
    expect(AVATAR_SPECS.map((spec) => spec.id)).toEqual([...AVATAR_IDS]);

    for (const spec of AVATAR_SPECS) {
      const published = readFileSync(
        resolve(process.cwd(), "public", "avatars", `${spec.id}.svg`),
        "utf8",
      );

      expect(published).toBe(renderAvatarSvg(spec));
    }
  });

  it("publica SVG estáticos sin scripts ni recursos externos", () => {
    for (const id of AVATAR_IDS) {
      const svg = readFileSync(resolve(process.cwd(), "public", "avatars", `${id}.svg`), "utf8");

      expect(svg).not.toMatch(/<script|href=|on[a-z]+=|url\(/i);
    }
  });

  it("coincide con la restricción SQL del catálogo", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase", "migrations", "20261022050000_more_avatars.sql"),
      "utf8",
    );
    const sqlPattern = /avatar_id ~ '(\^avatar-[^']+\$)'/.exec(migration)?.[1];

    expect(sqlPattern).toBeDefined();

    const allowed = new RegExp(sqlPattern ?? "$^");

    for (const id of AVATAR_IDS) {
      expect(allowed.test(id)).toBe(true);
    }

    expect(allowed.test("avatar-25")).toBe(false);
    expect(allowed.test("avatar-00")).toBe(false);
    expect(isAvatarId("avatar-25")).toBe(false);
  });
});

describe("logo de Digit@l Solutions", () => {
  it("el SVG publicado coincide con el generador y es estático", async () => {
    const { renderBrandSvg } = await import("@/scripts/generate-brand.mjs");
    const published = readFileSync(resolve(process.cwd(), "public", "brand", "digital-solutions.svg"), "utf8");

    expect(published).toBe(renderBrandSvg());
    expect(published).not.toMatch(/<script|href=|on[a-z]+=|url\(/i);
  });
});
