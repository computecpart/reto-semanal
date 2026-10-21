import type { AuthError } from "@supabase/supabase-js";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  captcha_failed: "No fue posible validar la protección contra automatizaciones.",
  email_address_invalid: "El correo ingresado no es válido.",
  email_address_not_authorized:
    "El servicio de correo todavía no está habilitado para esta dirección.",
  email_not_confirmed: "Debes verificar tu correo antes de iniciar sesión.",
  email_provider_disabled: "El registro por correo no está disponible.",
  flow_state_expired: "El enlace expiró. Solicita uno nuevo.",
  flow_state_not_found: "El enlace ya no es válido. Solicita uno nuevo.",
  invalid_credentials: "El correo o la contraseña no son correctos.",
  otp_expired: "El código es incorrecto o ya expiró.",
  over_email_send_rate_limit:
    "Debes esperar antes de solicitar otro correo.",
  over_request_rate_limit:
    "Se realizaron demasiados intentos. Espera unos minutos.",
  reauthentication_needed:
    "Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.",
  same_password: "La contraseña nueva debe ser diferente de la anterior.",
  weak_password:
    "La contraseña es demasiado débil o apareció en filtraciones conocidas. Elige otra.",
};

export function getAuthErrorMessage(
  error: Pick<AuthError, "code" | "status"> | null,
  fallback = "No fue posible completar la solicitud. Inténtalo de nuevo.",
): string {
  if (!error) {
    return fallback;
  }

  const knownMessage = error.code ? AUTH_ERROR_MESSAGES[error.code] : undefined;

  if (knownMessage) {
    return knownMessage;
  }

  if (error.status === 429) {
    return "Se realizaron demasiados intentos. Espera unos minutos.";
  }

  return fallback;
}

