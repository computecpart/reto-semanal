export const APP_ROLES = ["participant", "admin", "superadmin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const DEFAULT_APP_ROLE: AppRole = "participant";

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    APP_ROLES.some((candidate) => candidate === value)
  );
}

export function isAdministrativeRole(role: AppRole): boolean {
  return role === "admin" || role === "superadmin";
}

