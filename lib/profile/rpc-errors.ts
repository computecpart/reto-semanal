// Messages raised by our own PostgreSQL functions are safe to show verbatim.
// Anything else (casts, driver errors, English Postgres text) is replaced.
const DATABASE_MESSAGES = new Set([
  "El nombre no es válido.",
  "El apellido no es válido.",
  "El alias no está permitido.",
  "El departamento no es válido.",
  "La fecha de nacimiento no es válida.",
  "La fecha de nacimiento no puede estar en el futuro.",
  "La declaración de edad no coincide con la fecha de nacimiento.",
  "Los datos del perfil no son válidos.",
  "Debe aceptar las reglas y la política de privacidad.",
  "El perfil obligatorio está incompleto.",
  "Los datos históricos del registro no se pueden modificar.",
  "El teléfono no es válido.",
]);

export interface DatabaseErrorLike {
  code?: string | null;
  message?: string | null;
}

export function getProfileRpcErrorMessage(error: DatabaseErrorLike): string {
  if (error.code === "23505") {
    return "Ese alias ya está en uso. Elige otro.";
  }

  if (error.code === "42501") {
    return "Tu sesión no tiene permiso para esta operación. Vuelve a iniciar sesión.";
  }

  if (error.code === "P0002") {
    return "No encontramos un perfil válido para tu sesión.";
  }

  if (error.message && DATABASE_MESSAGES.has(error.message)) {
    return error.message;
  }

  return "No fue posible guardar el perfil. Inténtalo de nuevo.";
}
