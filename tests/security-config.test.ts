import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(fileName: string) {
  return readFileSync(resolve(process.cwd(), fileName), "utf8");
}

describe("configuración de seguridad", () => {
  it("no recibe secretos mediante variables públicas del proceso", () => {
    const forbiddenNames = Object.keys(process.env).filter((name) =>
      /^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/i.test(name),
    );

    expect(forbiddenNames).toEqual([]);
  });

  it("ignora los archivos locales de entorno requeridos", () => {
    const gitignore = readProjectFile(".gitignore");

    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.*.local");
    expect(gitignore).toContain(".env.seed.local");
  });

  it("no declara secretos con prefijo NEXT_PUBLIC", () => {
    const publicExample = readProjectFile(".env.example");
    const seedExample = readProjectFile(".env.seed.example");

    expect(publicExample).not.toMatch(/^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/im);
    expect(seedExample).not.toMatch(/^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/im);
    expect(seedExample).toContain("SUPABASE_SECRET_KEY=");
  });

  it("mantiene vacíos todos los valores de los archivos de ejemplo", () => {
    for (const fileName of [".env.example", ".env.seed.example"]) {
      const assignments = readProjectFile(fileName)
        .split(/\r?\n/)
        .filter((line) => line.length > 0);

      expect(assignments.every((line) => /^[A-Z][A-Z0-9_]*=$/.test(line))).toBe(
        true,
      );
    }
  });
});
