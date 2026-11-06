// Which campaign a request belongs to. /c/<slug>/... serves the same screens as
// /app/... for a private campaign: the proxy rewrites the path and forwards the
// slug in a header that reaches PostgreSQL, where private.requested_campaign_id()
// decides whether the caller may use it. Nothing here grants access.

export const CAMPAIGN_HEADER = "x-campaign";
export const ADMIN_CAMPAIGN_COOKIE = "admin_campaign";

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const CAMPAIGN_PATH = new RegExp(`^/c/(${SLUG})(/.*)?$`);
const SLUG_ONLY = new RegExp(`^${SLUG}$`);

// Shared pages that live outside /app.
const TOP_LEVEL_PAGES = new Set(["/reglas", "/aceptar-reglas"]);

export function isCampaignSlug(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 60 && SLUG_ONLY.test(value);
}

export function parseCampaignPath(pathname: string): { internalPath: string; slug: string } | null {
  const match = CAMPAIGN_PATH.exec(pathname);
  const slug = match?.[1];

  if (!slug || !isCampaignSlug(slug)) {
    return null;
  }

  const rest = (match[2] ?? "").replace(/\/$/, "");

  return { internalPath: TOP_LEVEL_PAGES.has(rest) ? rest : `/app${rest}`, slug };
}

/** Root of the participant area: /app for the main campaign. */
export function campaignBase(slug: string | null | undefined): string {
  return slug ? `/c/${slug}` : "/app";
}
