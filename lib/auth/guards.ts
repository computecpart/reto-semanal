import "server-only";

import { redirect } from "next/navigation";

import { resolveAdminAccess } from "@/lib/permissions/admin-access";

import { type AuthContext, getAuthContext } from "./get-auth-context";

/**
 * Server Component guard for participant-area pages. The proxy only performs
 * an optimistic cookie check; this verifies the session with Supabase Auth.
 */
export async function requireSessionPage(nextPath: string): Promise<AuthContext> {
  const context = await getAuthContext();

  if (!context) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return context;
}

/**
 * Server Component guard for every /admin page. The role comes from
 * private.user_roles through get_my_role(), never from user_metadata.
 */
export async function requireAdminPage(): Promise<AuthContext> {
  const context = await getAuthContext();
  const decision = resolveAdminAccess(context?.role);

  if (decision === "login" || !context) {
    redirect("/login?next=%2Fadmin");
  }

  if (decision === "forbidden") {
    redirect("/app/perfil?acceso=denegado");
  }

  return context;
}
