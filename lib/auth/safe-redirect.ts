// Closed allowlist: only known internal destinations survive. A redeem link
// keeps just its code, validated against the exact code alphabet.
const ALLOWED_POST_LOGIN_PATHS = new Set([
  "/admin",
  "/app/perfil",
  "/app/puntos",
  "/app/ranking",
  "/app/cuestionarios",
  "/app/canjear",
]);

const REDEEM_PATH = /^\/app\/canjear\?c=[2-9A-HJKMNP-Z]{4}-?[2-9A-HJKMNP-Z]{4}$/;

export function getSafePostLoginPath(value: unknown): string {
  if (typeof value !== "string") {
    return "/app/perfil";
  }

  if (ALLOWED_POST_LOGIN_PATHS.has(value) || REDEEM_PATH.test(value)) {
    return value;
  }

  return "/app/perfil";
}
