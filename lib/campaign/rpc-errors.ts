import type { DatabaseErrorLike } from "@/lib/profile/rpc-errors";

// Messages raised by our own campaign RPCs; anything else is replaced.
const DATABASE_MESSAGES = new Set([
  "No tienes permiso para esta operación.",
  "La campaña no existe.",
  "La versión no existe.",
  "Una campaña finalizada o archivada no se puede editar.",
  "Una campaña publicada necesita fechas de inicio y cierre.",
  "Ese cambio de estado no está permitido.",
  "Define las fechas de inicio y cierre antes de publicar.",
  "Publica las reglas antes de publicar la campaña.",
  "Publica la portada antes de publicar la campaña.",
  "Ya existe otra campaña publicada.",
  "El contenido de la portada no es válido.",
  "No hay reglas publicadas.",
]);

export function getCampaignRpcErrorMessage(error: DatabaseErrorLike): string {
  if (error.code === "23505") {
    return "Ya existe una campaña con ese identificador (slug).";
  }

  if (error.code === "23514") {
    return "Algún dato no cumple el formato permitido. Revisa nombre, slug y fechas.";
  }

  if (error.message && DATABASE_MESSAGES.has(error.message)) {
    return error.message;
  }

  if (error.code === "42501") {
    return "No tienes permiso para esta operación.";
  }

  return "No fue posible guardar los cambios. Inténtalo de nuevo.";
}
