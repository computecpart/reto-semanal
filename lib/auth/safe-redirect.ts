// Closed allowlist: only known internal destinations survive. A redeem link
// keeps just its code, validated against the exact code alphabet.
const ALLOWED_POST_LOGIN_PATHS = new Set([
  "/admin",
  "/app",
  "/app/perfil",
  "/app/puntos",
  "/app/ranking",
  "/app/cuestionarios",
  "/app/canjear",
]);

const CODE = "[2-9A-HJKMNP-Z]{4}-?[2-9A-HJKMNP-Z]{4}";
const CAMPAIGN_ROOT = "/c/[a-z0-9]+(?:-[a-z0-9]+)*";

const REDEEM_PATH = new RegExp(`^(?:/app|${CAMPAIGN_ROOT})/canjear\\?c=${CODE}$`);
const CAMPAIGN_PATH = new RegExp(`^${CAMPAIGN_ROOT}(?:/(?:perfil|puntos|ranking|cuestionarios|canjear|reglas))?$`);
const INVITE_PATH = /^\/unirse\/[0-9a-f]{32}\/aceptar$/;

export function getSafePostLoginPath(value: unknown): string {
  if (typeof value !== "string") {
    return "/app";
  }

  if (
    ALLOWED_POST_LOGIN_PATHS.has(value) ||
    REDEEM_PATH.test(value) ||
    CAMPAIGN_PATH.test(value) ||
    INVITE_PATH.test(value)
  ) {
    return value;
  }

  return "/app";
}
