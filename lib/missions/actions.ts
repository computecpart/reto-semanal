"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { collectFieldErrors, type ProfileFormState } from "@/lib/profile/form-state";
import { createClient } from "@/lib/supabase/server";

import { isValidCode, missionSchema, type MissionPreview } from "./schema";

type ActionState = ProfileFormState;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Messages raised by the mission admin RPCs; anything else is replaced.
const ADMIN_MESSAGES = new Set([
  "No tienes permiso para esta operación.",
  "Crea y publica una campaña antes de crear misiones.",
  "La misión no existe.",
  "Ya hay canjes: crea otra misión para cambiar los puntos.",
]);

function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

function failure(message: string, fieldErrors: ActionState["fieldErrors"] = {}): ActionState {
  return { fieldErrors, message, status: "error" };
}

function adminError(error: { code?: string | null; message?: string | null }): string {
  return error.message && ADMIN_MESSAGES.has(error.message)
    ? error.message
    : "No fue posible guardar la misión. Revisa los datos.";
}

async function isAdmin(): Promise<boolean> {
  const context = await getAuthContext();
  return Boolean(context && isAdministrativeRole(context.role));
}

export async function saveMissionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const missionId = text(formData, "missionId");

  if ((missionId && !UUID_PATTERN.test(missionId)) || !(await isAdmin())) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = missionSchema.safeParse({
    description: text(formData, "description"),
    enabled: formData.get("enabled") === "on",
    expiresAt: text(formData, "expiresAt"),
    name: text(formData, "name"),
    points: text(formData, "points"),
    startsAt: text(formData, "startsAt"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_reward", {
    p_description: parsed.data.description,
    p_enabled: parsed.data.enabled,
    p_expires_at: parsed.data.expiresAt,
    p_name: parsed.data.name,
    p_points: parsed.data.points,
    p_reward_id: missionId || null,
    p_starts_at: parsed.data.startsAt,
  });

  if (error || typeof data !== "string") {
    return failure(adminError(error ?? {}));
  }

  revalidatePath("/admin/misiones", "layout");

  if (!missionId) {
    redirect(`/admin/misiones/${data}`);
  }

  return { fieldErrors: {}, message: "Misión guardada.", status: "success" };
}

export async function regenerateCodeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const missionId = text(formData, "missionId");

  if (!UUID_PATTERN.test(missionId) || !(await isAdmin())) {
    return failure("No tienes permiso para esta operación.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_regenerate_reward_code", { p_reward_id: missionId });

  if (error) {
    return failure(adminError(error));
  }

  revalidatePath("/admin/misiones", "layout");
  return { fieldErrors: {}, message: "Código regenerado. El anterior ya no funciona.", status: "success" };
}

export type RedeemResult =
  | { message: string; status: "error" }
  | { name: string; points: number; status: "success" };

export async function previewMissionAction(code: string): Promise<{ message?: string; reward?: MissionPreview }> {
  if (!isValidCode(code)) {
    return { message: "Código no válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_reward", { p_code: code });

  if (error || !data) {
    return { message: "No fue posible verificar el código." };
  }

  const result = data as { message?: string; ok: boolean; reward?: MissionPreview };
  return result.ok ? { reward: result.reward } : { message: result.message };
}

export async function redeemMissionAction(code: string, channel: "manual" | "qr"): Promise<RedeemResult> {
  if (!isValidCode(code) || (channel !== "manual" && channel !== "qr")) {
    return { message: "Código no válido.", status: "error" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", { p_channel: channel, p_code: code });

  if (error || !data) {
    return { message: "No fue posible canjear. Inténtalo de nuevo.", status: "error" };
  }

  // Messages come from our own RPC (fixed strings, no user data).
  const result = data as { message?: string; name?: string; ok: boolean; points?: number };

  if (!result.ok) {
    return { message: result.message ?? "Código no válido.", status: "error" };
  }

  revalidatePath("/app", "layout");
  return { name: result.name ?? "", points: result.points ?? 0, status: "success" };
}
