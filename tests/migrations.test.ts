import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { EL_SALVADOR_DEPARTMENTS, RESERVED_ALIAS_TERMS } from "@/lib/validation/profile";

const migrationsDirectory = resolve(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sql = migrationFiles
  .map((name) => readFileSync(resolve(migrationsDirectory, name), "utf8"))
  .join("\n");

// Returns the latest definition, so create-or-replace fixes are what is checked.
function functionBody(name: string): string {
  const escaped = name.replace(/\./g, "\\.");
  const definitions = [
    ...sql.matchAll(new RegExp(`create (?:or replace )?function ${escaped}\\(`, "g")),
  ];
  const start = definitions.at(-1)?.index ?? -1;
  expect(start, `función ${name}`).toBeGreaterThan(-1);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

describe("migraciones de autenticación y perfil", () => {
  it("se aplican en orden por timestamp", () => {
    expect(migrationFiles.every((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))).toBe(true);
  });

  it("habilita RLS en toda tabla creada", () => {
    const tables = [...sql.matchAll(/create table (\w+\.\w+)/g)].map((match) => match[1]);

    expect(tables.length).toBeGreaterThan(0);

    for (const table of tables) {
      expect(sql, table).toContain(`alter table ${table} enable row level security`);
    }

    expect(sql).not.toMatch(/disable row level security/i);
  });

  it("no deriva roles de metadata manipulable por el usuario", () => {
    const executableSql = sql.replace(/--.*$/gm, "").replace(/comment on [\s\S]*?;/g, "");
    expect(executableSql).not.toMatch(/raw_app_meta_data|user_metadata/);

    const handler = functionBody("private.handle_new_user");
    expect(handler).toContain("'participant'::public.app_role");
    expect(handler).not.toMatch(/->>\s*'role'/);
  });

  it("resuelve el rol solo desde private.user_roles", () => {
    expect(functionBody("public.get_my_role")).toContain("from private.user_roles");
  });

  it("no concede escritura directa de perfiles ni roles a los clientes", () => {
    expect(sql).toContain("revoke update on table public.profiles from authenticated;");
    expect(sql).not.toMatch(/grant (?:insert|update|delete|all)[^;]*private\./i);
    expect(sql).not.toMatch(/grant (?:insert|delete|all)[^;]*public\.profiles/i);
  });

  it("el RPC de edición solo toca campos editables", () => {
    const update = functionBody("public.update_my_profile");

    expect(update).toContain("where id = (select auth.uid())");

    for (const forbidden of ["role", "birth_date", "age_declaration", "accepted_at", "points"]) {
      expect(update).not.toMatch(new RegExp(`\\b${forbidden}\\s*=`));
    }
  });

  it("restringe el bootstrap a la credencial service_role", () => {
    const bootstrap = functionBody("public.bootstrap_first_superadmin");

    expect(bootstrap).toContain("is distinct from 'service_role'");
    expect(sql).toContain(
      "revoke all on function public.bootstrap_first_superadmin(text) from public, anon, authenticated;",
    );
    expect(sql).toContain(
      "grant execute on function public.bootstrap_first_superadmin(text) to service_role;",
    );
  });

  it("usa unaccent con diccionario calificado (independiente de search_path)", () => {
    expect(functionBody("private.normalize_alias")).toContain(
      "'extensions.unaccent'::pg_catalog.regdictionary",
    );
  });

  it("mantiene los mismos departamentos que la aplicación", () => {
    const enumBody = /create type public\.elsalvador_department as enum \(([^)]+)\)/.exec(sql)?.[1];
    const departments = [...(enumBody ?? "").matchAll(/'([^']+)'/g)].map((match) => match[1]);

    expect(departments).toEqual([...EL_SALVADOR_DEPARTMENTS]);
  });

  it("reserva en PostgreSQL todos los términos administrativos", () => {
    for (const term of RESERVED_ALIAS_TERMS) {
      expect(sql).toContain(`('${term}', 'reserved')`);
    }
  });
});
