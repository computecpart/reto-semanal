import { describe, expect, it } from "vitest";

import { projectRefFromUrl, resolveBootstrapTarget } from "@/scripts/lib/supabase-target.mjs";

const REF = "abcdefghijklmnopqrst";

const environment = {
  EXPECTED_SUPABASE_PROJECT_REF: REF,
  SEED_SUPERADMIN_EMAIL: "Jefa@Empresa.com",
  SUPABASE_ENVIRONMENT: "demo",
  SUPABASE_PROJECT_REF: REF,
  SUPABASE_SECRET_KEY: "sb_secret_example",
  SUPABASE_URL: `https://${REF}.supabase.co`,
};

describe("destino del bootstrap", () => {
  it("acepta un destino coherente y confirmado", () => {
    expect(resolveBootstrapTarget(environment, [`--confirm=${REF}`])).toMatchObject({
      email: "jefa@empresa.com",
      environment: "demo",
      projectRef: REF,
    });
  });

  it("exige la confirmación explícita del proyecto", () => {
    expect(() => resolveBootstrapTarget(environment, [])).toThrow(/--confirm=/);
    expect(() => resolveBootstrapTarget(environment, ["--confirm=otro"])).toThrow(/--confirm=/);
  });

  it("rechaza referencias de proyecto incoherentes", () => {
    expect(() =>
      resolveBootstrapTarget(
        { ...environment, EXPECTED_SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz" },
        [`--confirm=${REF}`],
      ),
    ).toThrow(/mismo proyecto/);
  });

  it("rechaza producción salvo autorización explícita", () => {
    const production = { ...environment, SUPABASE_ENVIRONMENT: "production" };

    expect(() => resolveBootstrapTarget(production, [`--confirm=${REF}`])).toThrow(/Producción/);
    expect(
      resolveBootstrapTarget(production, [`--confirm=${REF}`, "--allow-production"]).environment,
    ).toBe("production");
  });

  it("rechaza variables faltantes y secretos públicos", () => {
    expect(() =>
      resolveBootstrapTarget({ ...environment, SUPABASE_SECRET_KEY: "" }, [`--confirm=${REF}`]),
    ).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() =>
      resolveBootstrapTarget(
        { ...environment, NEXT_PUBLIC_SUPABASE_SECRET_KEY: "x" },
        [`--confirm=${REF}`],
      ),
    ).toThrow(/NEXT_PUBLIC_/);
  });

  it("deriva la referencia desde la URL", () => {
    expect(projectRefFromUrl(`https://${REF}.supabase.co`)).toBe(REF);
    expect(projectRefFromUrl("http://127.0.0.1:54321")).toBe("local");
    expect(() => projectRefFromUrl(`http://${REF}.supabase.co`)).toThrow();
    expect(() => projectRefFromUrl("https://evil.example")).toThrow();
  });
});
