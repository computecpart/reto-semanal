import type { DatabaseErrorLike } from "@/lib/profile/rpc-errors";

// Messages raised by the quiz RPCs; anything else is replaced.
const DATABASE_MESSAGES = new Set([
  "No tienes permiso para esta operación.",
  "El cuestionario no existe.",
  "El cuestionario no es válido.",
  "Crea y publica una campaña antes de crear cuestionarios.",
  "Un cuestionario archivado no se puede editar.",
  "Máximo 10 opciones por pregunta.",
  "Marca solo una respuesta correcta por pregunta.",
  "Agrega al menos una pregunta.",
  "Cada pregunta de opción múltiple necesita al menos 2 opciones.",
  "Marca la respuesta correcta de cada pregunta de opción múltiple.",
  "Ese cambio de estado no está permitido.",
  "El cierre debe estar en el futuro.",
  "Ya hay participaciones: ciérralo en lugar de volver a borrador.",
  "El cuestionario ya tiene participaciones: duplícalo para cambiarlo.",
  "Ya completaste este cuestionario.",
  "Este cuestionario no está disponible.",
  "Tu cuenta no puede participar en cuestionarios.",
  "La campaña no está recibiendo puntuaciones.",
  "No puedes responder este intento.",
  "El tiempo de este cuestionario terminó.",
  "La pregunta no pertenece a este cuestionario.",
  "La opción no es válida.",
  "La respuesta supera el máximo de caracteres.",
  "No puedes enviar este intento.",
  "Esta respuesta no requiere revisión.",
  "La puntuación debe estar entre 0 y el máximo de la pregunta.",
  "Tu cuenta no puede sumar puntos.",
]);

export function getQuizRpcErrorMessage(error: DatabaseErrorLike): string {
  if (error.message && DATABASE_MESSAGES.has(error.message)) {
    return error.message;
  }

  if (error.code === "42501") {
    return "No tienes permiso para esta operación.";
  }

  if (error.code === "22P02" || error.code === "23514" || error.code === "22007") {
    return "Algún dato no tiene el formato correcto. Revisa fechas, números y textos.";
  }

  return "No fue posible completar la operación. Inténtalo de nuevo.";
}
