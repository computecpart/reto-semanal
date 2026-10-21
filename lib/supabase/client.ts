import "client-only";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { getPublicSupabaseEnv } from "@/lib/validation/env";

export function createClient() {
  const environment = getPublicSupabaseEnv();

  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SUPABASE_COOKIE_OPTIONS },
  );
}
