"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import type { ProfileFormState } from "@/lib/profile/form-state";
import { createClient } from "@/lib/supabase/server";

type ActionState = ProfileFormState;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUSES = ["active", "suspended", "disqualified", "archived"];
const ROLES = ["participant", "admin", "superadmin"];

// Messages raised by our moderation RPCs; anything else is replaced.
const MESSAGES = new Set([
  "No tienes permiso para esta operación.",
  "No puedes cambiar tu propio estado.",
  "El participante no existe.",
  "Un admin no puede moderar a otro admin ni a un superadmin.",
  "Describe el motivo con al menos 10 caracteres.",
  "El participante ya tiene ese estado.",
  "La campaña no existe.",
  "El término debe tener de 3 a 40 letras sin acentos ni espacios.",
  "Categoría no válida.",
  "No existe una cuenta con ese correo.",
  "La cuenta ya tiene ese rol.",
  "Debe quedar al menos un superadmin.",
  "No hay campaña actual.",
  "La semilla pública debe tener al menos 4 caracteres.",
  "Elige entre 1 y 20 ganadores (titular y suplentes).",
  "No hay suficientes participantes elegibles.",
]);

function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
}

function result(error: { message?: string | null } | null, success: string): ActionState {
  if (!error) {
    return { fieldErrors: {}, message: success, status: "success" };
  }

  return {
    fieldErrors: {},
    message: error.message && MESSAGES.has(error.message) ? error.message : "No fue posible completar la operación.",
    status: "error",
  };
}

const DENIED: ActionState = { fieldErrors: {}, message: "No tienes permiso para esta operación.", status: "error" };

async function staffOnly(): Promise<boolean> {
  const context = await getAuthContext();
  return Boolean(context && isAdministrativeRole(context.role));
}

export async function setParticipantStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const userId = text(formData, "userId");
  const status = text(formData, "status");

  if (!UUID_PATTERN.test(userId) || !STATUSES.includes(status) || !(await staffOnly())) {
    return DENIED;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_participant_status", {
    p_reason: text(formData, "reason"),
    p_status: status,
    p_user_id: userId,
  });

  revalidatePath("/admin", "layout");
  return result(error, "Estado actualizado.");
}

export async function setShowDisqualifiedAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const campaignId = text(formData, "campaignId");

  if (!UUID_PATTERN.test(campaignId) || !(await staffOnly())) {
    return DENIED;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_show_disqualified", {
    p_campaign_id: campaignId,
    p_show: formData.get("show") === "on",
  });

  revalidatePath("/", "layout");
  return result(error, "Preferencia guardada.");
}

export async function upsertBlockedTermAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffOnly())) {
    return DENIED;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_upsert_blocked_term", {
    p_active: formData.get("active") !== "off",
    p_category: text(formData, "category"),
    p_term: text(formData, "term"),
  });

  revalidatePath("/admin/alias");
  return result(error, "Término guardado.");
}

// The RPC enforces superadmin; this is only an early, friendlier refusal.
export async function setRoleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAuthContext();
  const role = text(formData, "role");

  if (context?.role !== "superadmin" || !ROLES.includes(role)) {
    return DENIED;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_email: text(formData, "email"),
    p_reason: text(formData, "reason"),
    p_role: role,
  });

  revalidatePath("/admin", "layout");
  return result(error, "Rol actualizado. La persona debe volver a cargar la página para ver el cambio.");
}

export async function runRaffleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await getAuthContext();

  if (context?.role !== "superadmin") {
    return DENIED;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_run_raffle", {
    p_public_seed: text(formData, "seed"),
    p_winners: Number(text(formData, "winners")),
  });

  revalidatePath("/admin/rifa");
  return result(error, "Sorteo realizado y registrado.");
}
