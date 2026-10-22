"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<never> {
  const supabase = await createClient();

  // "local" closes this device only; other devices keep their own sessions.
  await supabase.auth.signOut({ scope: "local" });

  redirect("/login?sesion=cerrada");
}

// Supabase token hashes are hex digests; anything else is rejected unread.
const TOKEN_HASH = /^[a-f0-9]{20,128}$/i;

/**
 * Completes a password recovery from the e-mail link. The link opens a page
 * with a button instead of verifying on GET, so mail scanners that pre-open
 * links cannot consume the single-use token. Works on any device or browser.
 */
export async function confirmRecoveryAction(formData: FormData): Promise<never> {
  const tokenHash = formData.get("token_hash");

  if (typeof tokenHash !== "string" || !TOKEN_HASH.test(tokenHash)) {
    redirect("/forgot-password?error=invalid-link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });

  redirect(error ? "/forgot-password?error=invalid-link" : "/reset-password");
}
