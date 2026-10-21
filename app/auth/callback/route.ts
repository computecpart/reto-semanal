import type { NextRequest } from "next/server";

import { noStoreRedirect } from "@/lib/auth/no-store-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (!error) {
      return noStoreRedirect(new URL("/reset-password", request.url));
    }
  }

  return noStoreRedirect(new URL("/forgot-password?error=invalid-link", request.url));
}
