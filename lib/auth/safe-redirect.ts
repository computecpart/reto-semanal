const ALLOWED_POST_LOGIN_PATHS = new Set(["/admin", "/app/perfil"]);

export function getSafePostLoginPath(value: unknown): string {
  if (typeof value !== "string" || !ALLOWED_POST_LOGIN_PATHS.has(value)) {
    return "/app/perfil";
  }

  return value;
}

