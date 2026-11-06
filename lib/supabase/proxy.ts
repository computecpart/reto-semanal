import "server-only";

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSafePostLoginPath } from "@/lib/auth/safe-redirect";
import { ADMIN_CAMPAIGN_COOKIE, CAMPAIGN_HEADER, isCampaignSlug, parseCampaignPath } from "@/lib/campaign/scope";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";
import { getPublicSupabaseEnv } from "@/lib/validation/env";

export async function updateSession(request: NextRequest) {
  const environment = getPublicSupabaseEnv();
  const scope = resolveScope(request);
  let response = forward(request, scope);

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = forward(request, scope);

          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;

  // Optimistic gate only: pages still verify the session and the role on the
  // server. Refreshed auth cookies must survive the redirect response.
  if (!data?.claims.sub && PROTECTED_PATH.test(pathname)) {
    const loginUrl = request.nextUrl.clone();
    const code = request.nextUrl.searchParams.get("c");
    // The login page re-validates this against the closed allowlist.
    const next = ADMIN_PATH.test(pathname)
      ? "/admin"
      : REDEEM_PATH.test(pathname) && code
        ? getSafePostLoginPath(`${pathname}?c=${code}`)
        : getSafePostLoginPath(pathname);
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", next);

    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

interface RequestScope {
  rewrite: string | null;
  slug: string | null;
}

// Only the proxy sets the campaign header: whatever a client sends is dropped.
function resolveScope(request: NextRequest): RequestScope {
  const pathname = request.nextUrl.pathname;
  const campaign = parseCampaignPath(pathname);

  if (campaign) {
    return { rewrite: campaign.internalPath, slug: campaign.slug };
  }

  const selected = request.cookies.get(ADMIN_CAMPAIGN_COOKIE)?.value;

  return { rewrite: null, slug: ADMIN_PATH.test(pathname) && isCampaignSlug(selected) ? selected : null };
}

function forward(request: NextRequest, scope: RequestScope) {
  if (!scope.slug && !request.headers.has(CAMPAIGN_HEADER)) {
    return NextResponse.next({ request });
  }

  const headers = new Headers(request.headers);

  if (scope.slug) {
    headers.set(CAMPAIGN_HEADER, scope.slug);
  } else {
    headers.delete(CAMPAIGN_HEADER);
  }

  if (!scope.rewrite) {
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = scope.rewrite;

  return NextResponse.rewrite(url, { request: { headers } });
}

const PROTECTED_PATH = /^\/(?:app|admin|vista-previa|aceptar-reglas|c\/[^/]+|unirse\/[^/]+\/aceptar)(?:\/|$)/;
const ADMIN_PATH = /^\/(?:admin|vista-previa)(?:\/|$)/;
const REDEEM_PATH = /^\/(?:app|c\/[^/]+)\/canjear$/;
