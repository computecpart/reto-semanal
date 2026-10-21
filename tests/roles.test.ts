import { describe, expect, it } from "vitest";

import {
  APP_ROLES,
  DEFAULT_APP_ROLE,
  isAdministrativeRole,
  isAppRole,
} from "@/lib/permissions/roles";

describe("roles", () => {
  it("mantiene exactamente los tres roles canónicos", () => {
    expect(APP_ROLES).toEqual(["participant", "admin", "superadmin"]);
    expect(DEFAULT_APP_ROLE).toBe("participant");
  });

  it.each(APP_ROLES)("reconoce el rol %s", (role) => {
    expect(isAppRole(role)).toBe(true);
  });

  it.each(["owner", "Admin", "", null, undefined, 1])(
    "rechaza el rol no canónico %s",
    (role) => {
      expect(isAppRole(role)).toBe(false);
    },
  );

  it("solo considera administrativos a admin y superadmin", () => {
    expect(isAdministrativeRole("participant")).toBe(false);
    expect(isAdministrativeRole("admin")).toBe(true);
    expect(isAdministrativeRole("superadmin")).toBe(true);
  });
});

