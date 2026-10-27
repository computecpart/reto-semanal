import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isPwnedPassword, localPasswordIssue, passwordChecklist } from "@/lib/auth/password-strength";

describe("guía de contraseñas", () => {
  it.each(["12345678", "123456789", "87654321", "aaaaaaaa", "qwertyuiop", "abcdefgh"])(
    "rechaza secuencias y repeticiones: %s",
    (password) => {
      expect(localPasswordIssue(password)).not.toBeNull();
    },
  );

  it.each(["password1", "Dragon2026!", "contraseña123", "msimsi2026", "Piensads2026"])(
    "rechaza palabras comunes con números: %s",
    (password) => {
      expect(localPasswordIssue(password)).not.toBeNull();
    },
  );

  it("rechaza datos personales", () => {
    const context = { alias: "rakkun", email: "maria.lopez@piensads.com", firstName: "María", lastName: "López" };
    expect(localPasswordIssue("Rakkun#2026", context)).toMatch(/nombre, alias ni correo/);
    expect(localPasswordIssue("maria.lopez!!", context)).toMatch(/nombre, alias ni correo/);
    expect(localPasswordIssue("mariaGato77", context)).toMatch(/nombre, alias ni correo/);
  });

  it("acepta frases difíciles de adivinar", () => {
    expect(localPasswordIssue("Volcan-Mango-Lapiz-74", { firstName: "Ana" })).toBeNull();
    expect(passwordChecklist("Volcan-Mango-Lapiz-74").every((item) => item.ok)).toBe(true);
  });

  it("la lista guía refleja el avance", () => {
    expect(passwordChecklist("").some((item) => item.ok)).toBe(false);
    expect(passwordChecklist("12345678").map((item) => item.ok)).toEqual([true, false, false]);
  });
});

describe("consulta de filtraciones (k-anonimato)", () => {
  const hash = createHash("sha1").update("P@ssw0rd").digest("hex").toUpperCase();

  function fakeFetch(body: string, ok = true) {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok, text: async () => body } as Response;
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  }

  it("solo envía los 5 primeros caracteres del hash", async () => {
    const { calls, fetcher } = fakeFetch(`${hash.slice(5)}:12345\r\nABCDEF0123:0`);
    await expect(isPwnedPassword("P@ssw0rd", fetcher)).resolves.toBe(true);
    expect(calls).toEqual([`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`]);
    expect(calls[0]).not.toContain(hash.slice(5));
  });

  it("ignora las líneas de relleno con contador 0", async () => {
    const { fetcher } = fakeFetch(`${hash.slice(5)}:0`);
    await expect(isPwnedPassword("P@ssw0rd", fetcher)).resolves.toBe(false);
  });

  it("si el servicio falla no bloquea (decide Supabase)", async () => {
    const { fetcher } = fakeFetch("", false);
    await expect(isPwnedPassword("P@ssw0rd", fetcher)).resolves.toBeNull();
    const broken = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await expect(isPwnedPassword("P@ssw0rd", broken)).resolves.toBeNull();
  });
});
