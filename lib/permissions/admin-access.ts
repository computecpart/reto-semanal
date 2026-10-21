import { isAdministrativeRole, isAppRole } from "./roles";

export type AdminAccessDecision = "allow" | "forbidden" | "login";

/**
 * Produces a side-effect-free decision that server layouts can turn into a
 * redirect or an authorization success. Unknown roles fail closed.
 */
export function resolveAdminAccess(role: unknown): AdminAccessDecision {
  if (role === null || role === undefined) {
    return "login";
  }

  if (!isAppRole(role) || !isAdministrativeRole(role)) {
    return "forbidden";
  }

  return "allow";
}
