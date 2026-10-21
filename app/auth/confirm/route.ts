import type { NextRequest } from "next/server";

import { noStoreRedirect } from "@/lib/auth/no-store-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Fallback for sign-up confirmation links. The primary flow is the in-app OTP
 * code; this route serves projects whose email template still sends
 * {{ .ConfirmationURL }} (e.g. the default provider before custom SMTP).
 *
 * Supabase confirms the address when the link is opened, before redirecting
 * here, so a failed PKCE exchange (another browser) still means "verified".
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");

  if (!code) {
    // Expired or reused links arrive with error params and no code.
    return noStoreRedirect(new URL("/verificar-correo?error=enlace", request.url));
  }

  const supabase = await createClient();
  const flowId = params.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  return noStoreRedirect(
    new URL(error ? "/login?verified=1" : "/app/perfil", request.url),
  );
}
