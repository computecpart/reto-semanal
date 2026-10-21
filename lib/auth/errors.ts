export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Se requiere una sesión autenticada.");
    this.name = "AuthenticationRequiredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("La sesión no tiene permiso para realizar esta operación.");
    this.name = "PermissionDeniedError";
  }
}

