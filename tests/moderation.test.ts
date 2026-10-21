import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { drawRaffle } from "@/lib/moderation/raffle";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022030000_moderation_raffle.sql"), "utf8");
const fix = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022040000_raffle_count_fix.sql"), "utf8");

function body(source: string, name: string): string {
  const start = source.search(new RegExp(`function ${name.replace(".", "\\.")}\\(`));
  expect(start, name).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("$$;", start));
}

describe("rifa verificable", () => {
  it("la réplica en TypeScript produce la misma huella que PostgreSQL", () => {
    // Value computed by public.admin_raffle_preview in production for this list.
    expect(drawRaffle("x", ["YTZK-U5TM"], 1).listHash).toBe(
      "414623319c23ef830ef8e670603802f3e1c8f84e0a488b6e3f25ad3c19479057",
    );
  });

  it("es determinista, sin repetidos y respeta el orden de la lista", () => {
    const codes = ["CCCC-2222", "AAAA-2222", "BBBB-2222", "DDDD-2222", "EEEE-2222"];
    const first = drawRaffle("Lotería 4821", codes, 3);

    expect(drawRaffle("Lotería 4821", [...codes].reverse(), 3)).toEqual(first);
    expect(new Set(first.winners).size).toBe(3);
    expect(drawRaffle("Lotería 4822", codes, 3).winners).not.toEqual(first.winners);
  });

  it("el SQL usa el mismo algoritmo y queda auditado", () => {
    const run = body(fix, "public.admin_run_raffle");

    expect(run).toContain("private.require_role('superadmin')");
    expect(run).toContain("':' || v_hash || ':' || v_round, 'sha256'");
    expect(run).toContain("pg_catalog.left(v_digest, 15)");
    expect(run).toContain("'raffle.draw'");
    expect(sql).toMatch(/before update or delete on private\.raffle_draws/);
  });
});

describe("moderación y roles", () => {
  it("un admin solo modera participantes y nadie se modera a sí mismo", () => {
    const status = body(sql, "public.admin_set_participant_status");

    expect(status).toContain("v_actor_role = 'admin'::public.app_role and v_target_role <> 'participant'::public.app_role");
    expect(status).toContain("p_user_id = (select auth.uid())");
    expect(status).toContain("'participant.status'");
  });

  it("solo superadmin cambia roles y siempre queda uno", () => {
    const role = body(sql, "public.admin_set_role");

    expect(role).toContain("private.require_role('superadmin')");
    expect(role).toContain("where role = 'superadmin'::public.app_role for update");
    expect(role).toContain("Debe quedar al menos un superadmin.");
    expect(role).toContain("insert into private.role_audit_log");
    expect(role).toContain("'role.change'");
  });

  it("la exportación de datos personales es solo de superadmin y se audita", () => {
    const exported = body(sql, "public.admin_export_participants");

    expect(exported).toContain("private.require_role('superadmin')");
    expect(exported).toContain("'participants.export'");
  });

  it("la lista pública de descalificados nunca expone el motivo", () => {
    const list = body(sql, "public.get_disqualified_participants");

    expect(list).not.toContain("reason");
    expect(list).toContain("campaigns.ranking_show_disqualified");
  });

  it("los términos de alias desactivados dejan de bloquear y los cambios se auditan", () => {
    expect(body(sql, "private.alias_is_allowed")).toContain("where blocked.active");
    expect(body(sql, "public.admin_upsert_blocked_term")).toContain("'alias_term.upsert'");
  });
});
