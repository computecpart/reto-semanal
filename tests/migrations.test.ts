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

  it("nunca concede escritura directa sobre tablas públicas a los clientes", () => {
    const writeGrants = [
      ...sql.matchAll(/grant (?:insert|update|delete|truncate|all)[^;]* on table public\.[^;]*;/gi),
    ].map((match) => match[0]);

    // The foundation's display_name grant is revoked by the next migration.
    expect(writeGrants).toEqual(["grant update (display_name) on table public.profiles to authenticated;"]);
    expect(sql.indexOf("revoke update (display_name) on table public.profiles from authenticated;")).toBeGreaterThan(
      sql.indexOf(writeGrants[0] ?? ""),
    );
  });

  it("todas las RPC administrativas exigen rol y quedan restringidas", () => {
    const adminFunctions = [...sql.matchAll(/create (?:or replace )?function (public\.admin_\w+)\(/g)].map(
      (match) => match[1] as string,
    );

    expect(adminFunctions.length).toBeGreaterThanOrEqual(7);

    for (const name of adminFunctions) {
      expect(functionBody(name), name).toContain("private.require_role('admin', 'superadmin')");
      expect(sql, name).toMatch(new RegExp(`revoke all on function ${name.replace(".", "\\.")}\\([^)]*\\) from public, anon;`));
    }
  });

  it("las mutaciones administrativas de campaña quedan auditadas", () => {
    for (const name of [
      "public.admin_create_campaign",
      "public.admin_update_campaign",
      "public.admin_set_campaign_status",
      "public.admin_publish_landing",
      "public.admin_restore_landing_version",
      "public.admin_publish_rules",
    ]) {
      expect(functionBody(name), name).toContain("private.write_audit(");
    }
  });

  it("la auditoría, el historial de portada y las reglas publicadas son inmutables", () => {
    expect(sql).toMatch(/before update or delete on private\.audit_log/);
    expect(sql).toMatch(/before truncate on private\.audit_log/);
    expect(sql).toMatch(/before update or delete on public\.landing_page_versions/);
    expect(sql).toMatch(/before update or delete on public\.campaign_rules_versions/);
  });

  it("la portada pública nunca expone el borrador", () => {
    const body = functionBody("public.get_public_landing");

    expect(body).toContain("landing.published");
    expect(body).not.toMatch(/\bdraft\b/);
  });

  it("el bucket de imágenes solo acepta formatos raster y escritura de admins", () => {
    expect(sql).toContain("array['image/png', 'image/jpeg', 'image/webp']");
    expect(sql).not.toMatch(/image\/svg/);

    const storagePolicies = [...sql.matchAll(/create policy "landing_assets_\w+"[\s\S]*?;/g)].map(
      (match) => match[0],
    );

    expect(storagePolicies).toHaveLength(4);

    for (const policy of storagePolicies) {
      expect(policy).toContain("public.is_admin()");
    }
  });

  it("el alta registra la aceptación de las reglas vigentes sin tocar el rol", () => {
    const handler = functionBody("private.handle_new_user");

    expect(handler).toContain("insert into public.rules_acceptances");
    expect(handler).toContain("'participant'::public.app_role");
  });

  it("reserva en PostgreSQL todos los términos administrativos", () => {
    for (const term of RESERVED_ALIAS_TERMS) {
      expect(sql).toContain(`('${term}', 'reserved')`);
    }
  });
});

describe("migración de identidad, puntos y ranking", () => {
  it("el ledger de puntos es de solo inserción y sin escritura para clientes", () => {
    expect(sql).toMatch(/before update or delete on public\.point_events/);
    expect(sql).toMatch(/before truncate on public\.point_events/);
    expect(sql).toContain("revoke all on table public.point_events from public, anon, authenticated;");
    expect(sql).not.toMatch(/grant (?:insert|update|delete|all)[^;]*public\.point_events/i);
  });

  it("cada actividad puntúa una sola vez y cada movimiento se revierte una sola vez", () => {
    expect(sql).toMatch(/create unique index point_events_source_once[\s\S]*?\(campaign_id, user_id, kind, source_type, source_id\)/);
    expect(sql).toMatch(/create unique index point_events_reversed_once[\s\S]*?\(reverses_event_id\)/);
  });

  it("award_points es interna y valida campaña vigente y participante habilitado", () => {
    const body = functionBody("private.award_points");

    expect(body).toContain("private.participant_can_earn(p_user_id)");
    expect(body).toContain("private.is_competitor(p_user_id)");
    expect(body).toContain("pg_catalog.statement_timestamp() < campaigns.ends_at");
    expect(body).toContain("do nothing");
    expect(sql).toMatch(/revoke all on function private\.award_points\([^)]*\)\s*from public, anon, authenticated;/);
  });

  it("el ranking público nunca devuelve datos privados", () => {
    const body = functionBody("public.get_ranking");

    for (const column of ["birth_date", "department", "phone", "age_declaration", "email"]) {
      expect(body).not.toContain(column);
    }

    expect(body).toContain("pg_catalog.right(profiles.passport_code, 4)");
    // The full code is never selected; only its last four characters.
    expect(body.replaceAll("pg_catalog.right(profiles.passport_code, 4)", "")).not.toContain("passport_code");
  });

  it("los desempates siguen la regla 7: puntos, aciertos y eventos", () => {
    expect(functionBody("private.campaign_standings")).toContain(
      "order by totals.points desc, totals.correct_answers desc, totals.events_completed desc",
    );
  });

  it("los ajustes y reversiones de puntos quedan auditados", () => {
    expect(functionBody("public.admin_adjust_points")).toContain("'points.adjust'");
    expect(functionBody("public.admin_reverse_point_event")).toContain("'points.reverse'");
    expect(functionBody("public.admin_update_ranking_settings")).toContain("'ranking.settings'");
  });

  it("el alta exige teléfono válido y crea el estado del participante", () => {
    const handler = functionBody("private.handle_new_user");

    expect(handler).toContain("'^\\+503[267][0-9]{7}$'");
    expect(handler).toContain("insert into private.participant_states");
    expect(handler).toContain("'passport_code'");
  });
});
