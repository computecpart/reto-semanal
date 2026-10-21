import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { isAppRole, type AppRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export interface AuthContext {
  role: AppRole;
  user: User;
}

// Deduplicated per request so a layout and its page share one Auth round trip.
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: role, error: roleError } = await supabase.rpc("get_my_role");

  if (roleError || !isAppRole(role)) {
    throw new Error("No fue posible resolver el rol confiable de la sesión.");
  }

  return { role, user };
});
