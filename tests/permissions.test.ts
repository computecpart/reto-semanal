import { describe, expect, it } from "vitest";

import type { AppRole } from "@/lib/permissions/roles";
import {
  canManageAdministrativeRoles,
  canManageTarget,
} from "@/lib/permissions/users";

const cases: ReadonlyArray<readonly [AppRole, AppRole, boolean]> = [
  ["participant", "participant", false],
  ["participant", "admin", false],
  ["participant", "superadmin", false],
  ["admin", "participant", true],
  ["admin", "admin", false],
  ["admin", "superadmin", false],
  ["superadmin", "participant", true],
  ["superadmin", "admin", true],
  ["superadmin", "superadmin", true],
];

describe("permisos de administración", () => {
  it.each(cases)(
    "%s administrando a %s produce %s",
    (actor, target, expected) => {
      expect(canManageTarget(actor, target)).toBe(expected);
    },
  );

  it("reserva la administración de roles administrativos al superadmin", () => {
    expect(canManageAdministrativeRoles("participant")).toBe(false);
    expect(canManageAdministrativeRoles("admin")).toBe(false);
    expect(canManageAdministrativeRoles("superadmin")).toBe(true);
  });
});

