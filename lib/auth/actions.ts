"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<never> {
  const supabase = await createClient();

  // "local" closes this device only; other devices keep their own sessions.
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login?sesion=cerrada");
}
