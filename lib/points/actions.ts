"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { collectFieldErrors, type ProfileFormState } from "@/lib/profile/form-state";
import { createClient } from "@/lib/supabase/server";

import { pointAdjustmentSchema, pointReversalSchema, rankingSettingsSchema } from "./config";
import { getPointsRpcErrorMessage } from "./rpc-errors";

type ActionState = ProfileFormState;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

function failure(message: string, fieldErrors: ActionState["fieldErrors"] = {}): ActionState {
  return { fieldErrors, message, status: "error" };
}

// Defense in depth: every RPC enforces the role again with private.require_role.
async function adminCampaignId(formData: FormData): Promise<string | null> {
  const context = await getAuthContext();
  const campaignId = text(formData, "campaignId");

  return context && isAdministrativeRole(context.role) && UUID_PATTERN.test(campaignId)
    ? campaignId
    : null;
}

function revalidateRanking() {
  revalidatePath("/");
  revalidatePath("/app", "layout");
  revalidatePath("/admin/ranking");
}

export async function updateRankingSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = await adminCampaignId(formData);

  if (!campaignId) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = rankingSettingsSchema.safeParse({
    audience: text(formData, "audience"),
    highlightTop: text(formData, "highlightTop"),
    identity: text(formData, "identity"),
    visible: formData.get("visible") === "on",
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_ranking_settings", {
    p_audience: parsed.data.audience,
    p_campaign_id: campaignId,
    p_highlight_top: parsed.data.highlightTop,
    p_identity: parsed.data.identity,
    p_visible: parsed.data.visible,
  });

  if (error) {
    return failure(getPointsRpcErrorMessage(error));
  }

  revalidateRanking();
  return { fieldErrors: {}, message: "Configuración del ranking guardada.", status: "success" };
}

export async function adjustPointsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = await adminCampaignId(formData);

  if (!campaignId) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = pointAdjustmentSchema.safeParse({
    amount: text(formData, "amount"),
    description: text(formData, "description"),
    reason: text(formData, "reason"),
    userId: text(formData, "userId"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_points", {
    p_amount: parsed.data.amount,
    p_campaign_id: campaignId,
    p_description: parsed.data.description,
    p_reason: parsed.data.reason,
    p_user_id: parsed.data.userId,
  });

  if (error) {
    return failure(getPointsRpcErrorMessage(error));
  }

  revalidateRanking();
  return { fieldErrors: {}, message: "Ajuste registrado.", status: "success" };
}

export async function reversePointEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = await adminCampaignId(formData);

  if (!campaignId) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = pointReversalSchema.safeParse({
    eventId: text(formData, "eventId"),
    reason: text(formData, "reason"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reverse_point_event", {
    p_event_id: parsed.data.eventId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return failure(getPointsRpcErrorMessage(error));
  }

  revalidateRanking();
  return { fieldErrors: {}, message: "Movimiento revertido con una corrección.", status: "success" };
}
