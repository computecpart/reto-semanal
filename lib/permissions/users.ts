import type { AppRole } from "./roles";

export function canManageTarget(actor: AppRole, target: AppRole): boolean {
  if (actor === "superadmin") {
    return true;
  }

  return actor === "admin" && target === "participant";
}

export function canManageAdministrativeRoles(actor: AppRole): boolean {
  return actor === "superadmin";
}

