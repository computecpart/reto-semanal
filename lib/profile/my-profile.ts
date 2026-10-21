import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AgeDeclaration, Department } from "@/lib/validation/profile";

export interface MyProfile {
  age_declaration: AgeDeclaration | null;
  alias: string | null;
  avatar_id: string | null;
  birth_date: string | null;
  created_at: string;
  department: Department | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  marketing_consent_at: string | null;
  passport_code: string;
  phone: string | null;
  profile_completed_at: string | null;
}

const PROFILE_COLUMNS =
  "id, first_name, last_name, alias, birth_date, age_declaration, department, avatar_id, phone, marketing_consent_at, passport_code, profile_completed_at, created_at";

/** Reads only the caller's row; RLS (profiles_select_own) enforces the scope. */
export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle<MyProfile>();

  if (error) {
    throw new Error("No fue posible cargar el perfil.");
  }

  return data;
}
