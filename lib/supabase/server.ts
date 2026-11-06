import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { CAMPAIGN_HEADER } from "@/lib/campaign/scope";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { getPublicSupabaseEnv } from "@/lib/validation/env";

export async function createClient() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const environment = getPublicSupabaseEnv();
  // Set by the root proxy only; PostgreSQL validates it for every request.
  const campaign = requestHeaders.get(CAMPAIGN_HEADER);

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      ...(campaign ? { global: { headers: { [CAMPAIGN_HEADER]: campaign } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, options, value }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies. The root proxy refreshes them.
          }
        },
      },
    },
  );
}
