import "server-only";

import type { AppRole } from "@/lib/permissions/roles";

import {
  AuthenticationRequiredError,
  PermissionDeniedError,
} from "./errors";
import { getAuthContext } from "./get-auth-context";

export async function requireRole(allowedRoles: readonly AppRole[]) {
  const context = await getAuthContext();

  if (!context) {
    throw new AuthenticationRequiredError();
  }

  if (!allowedRoles.includes(context.role)) {
    throw new PermissionDeniedError();
  }

  return context;
}
