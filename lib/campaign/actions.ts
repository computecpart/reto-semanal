"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createDefaultLanding } from "@/lib/landing/defaults";
import { landingContentSchema } from "@/lib/landing/schema";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { collectFieldErrors, type ProfileFormState } from "@/lib/profile/form-state";
import { createClient } from "@/lib/supabase/server";

import { getCampaignRpcErrorMessage } from "./rpc-errors";
import {
  campaignDetailsSchema,
  campaignIdentitySchema,
  campaignStatusChangeSchema,
  rulesPublishSchema,
} from "./schemas";

export type ActionState = ProfileFormState;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

function failure(message: string, fieldErrors: ActionState["fieldErrors"] = {}): ActionState {
  return { fieldErrors, message, status: "error" };
}

function success(message: string): ActionState {
  return { fieldErrors: {}, message, status: "success" };
}

// Defense in depth: the RPCs enforce the role again with private.require_role.
async function isAdminSession(): Promise<boolean> {
  const context = await getAuthContext();
  return Boolean(context && isAdministrativeRole(context.role));
}

function revalidateCampaign(campaignId: string) {
  revalidatePath("/");
  revalidatePath("/reglas");
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/campana/${campaignId}`, "layout");
}

export async function createCampaignAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = campaignIdentitySchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_campaign", {
    p_landing_draft: createDefaultLanding(),
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error || typeof data !== "string") {
    return failure(getCampaignRpcErrorMessage(error ?? {}));
  }

  revalidatePath("/admin", "layout");
  redirect(`/admin/campana/${data}`);
}

export async function updateCampaignAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = text(formData, "campaignId");

  if (!UUID_PATTERN.test(campaignId) || !(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = campaignDetailsSchema.safeParse({
    endsAt: text(formData, "endsAt"),
    name: text(formData, "name"),
    prizeDescription: text(formData, "prizeDescription"),
    prizeTitle: text(formData, "prizeTitle"),
    slug: text(formData, "slug"),
    startsAt: text(formData, "startsAt"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_campaign", {
    p_campaign_id: campaignId,
    p_ends_at: parsed.data.endsAt,
    p_name: parsed.data.name,
    p_prize_description: parsed.data.prizeDescription,
    p_prize_title: parsed.data.prizeTitle,
    p_slug: parsed.data.slug,
    p_starts_at: parsed.data.startsAt,
  });

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidateCampaign(campaignId);
  return success("Campaña guardada.");
}

export async function setCampaignStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = text(formData, "campaignId");

  if (!UUID_PATTERN.test(campaignId) || !(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = campaignStatusChangeSchema.safeParse({
    reason: text(formData, "reason"),
    status: text(formData, "status"),
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_campaign_status", {
    p_campaign_id: campaignId,
    p_reason: parsed.data.reason,
    p_status: parsed.data.status,
  });

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidateCampaign(campaignId);
  return success("Estado actualizado.");
}

async function saveDraft(campaignId: string, content: unknown): Promise<ActionState | null> {
  const parsed = landingContentSchema.safeParse(content);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const sectionIndex = issue?.path[0] === "sections" ? issue.path[1] : undefined;
    const where = typeof sectionIndex === "number" ? ` (sección ${sectionIndex + 1})` : "";
    return failure(`${issue?.message ?? "Contenido no válido."}${where}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_landing_draft", {
    p_campaign_id: campaignId,
    p_draft: parsed.data,
  });

  return error ? failure(getCampaignRpcErrorMessage(error)) : null;
}

export async function saveLandingDraftAction(
  campaignId: string,
  content: unknown,
): Promise<ActionState> {
  if (!UUID_PATTERN.test(campaignId) || !(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const saveError = await saveDraft(campaignId, content);

  if (saveError) {
    return saveError;
  }

  revalidatePath(`/admin/campana/${campaignId}`, "layout");
  return success("Borrador guardado.");
}

export async function publishLandingAction(
  campaignId: string,
  content: unknown,
): Promise<ActionState> {
  if (!UUID_PATTERN.test(campaignId) || !(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const saveError = await saveDraft(campaignId, content);

  if (saveError) {
    return saveError;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_publish_landing", {
    p_campaign_id: campaignId,
  });

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidateCampaign(campaignId);
  return success(`Portada publicada (versión ${String(data)}).`);
}

export async function restoreLandingVersionAction(
  campaignId: string,
  version: number,
): Promise<ActionState> {
  if (
    !UUID_PATTERN.test(campaignId) ||
    !Number.isInteger(version) ||
    version < 1 ||
    !(await isAdminSession())
  ) {
    return failure("No tienes permiso para esta operación.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_landing_version", {
    p_campaign_id: campaignId,
    p_version: version,
  });

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidatePath(`/admin/campana/${campaignId}`, "layout");
  return success(`Versión ${version} copiada al borrador. Revísala y publícala.`);
}

export async function publishRulesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const campaignId = text(formData, "campaignId");

  if (!UUID_PATTERN.test(campaignId) || !(await isAdminSession())) {
    return failure("No tienes permiso para esta operación.");
  }

  const parsed = rulesPublishSchema.safeParse({
    changeSummary: text(formData, "changeSummary"),
    contentMd: text(formData, "contentMd"),
    isMajor: formData.get("isMajor") === "on",
  });

  if (!parsed.success) {
    return failure("Revisa los campos marcados.", collectFieldErrors(parsed.error.issues));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_publish_rules", {
    p_campaign_id: campaignId,
    p_change_summary: parsed.data.changeSummary,
    p_content_md: parsed.data.contentMd,
    p_is_major: parsed.data.isMajor,
  });

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidateCampaign(campaignId);
  return success(`Reglas publicadas (versión ${String(data)}).`);
}

export async function acceptRulesAction(_previous: ActionState): Promise<ActionState> {
  if (!(await getAuthContext())) {
    return failure("Tu sesión expiró. Vuelve a iniciar sesión.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_current_rules");

  if (error) {
    return failure(getCampaignRpcErrorMessage(error));
  }

  revalidatePath("/app", "layout");
  redirect("/app/perfil");
}
