import type { DatabaseErrorLike } from "@/lib/profile/rpc-errors";

// Messages raised by our own point RPCs; anything else is replaced.
const DATABASE_MESSAGES = new Set([
  "No tienes permiso para esta operación.",
  "La campaña no existe.",
  "Solo se ajustan puntos de participantes.",
  "El ajuste no es válido.",
  "Describe el motivo con al menos 10 caracteres.",
  "El movimiento no existe.",
  "Una corrección no se puede revertir.",
  "Ese movimiento ya fue revertido.",
]);

export function getPointsRpcErrorMessage(error: DatabaseErrorLike): string {
  if (error.message && DATABASE_MESSAGES.has(error.message)) {
    return error.message;
  }

  if (error.code === "42501") {
    return "No tienes permiso para esta operación.";
  }

  if (error.code === "23514") {
    return "Algún valor no cumple el formato permitido.";
  }

  return "No fue posible completar la operación. Inténtalo de nuevo.";
}
