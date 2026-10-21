"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import {
  createProfileCompletionSchema,
  getOperationalDate,
  profileUpdateSchema,
} from "@/lib/validation/profile";

import {
  collectFieldErrors,
  type ProfileFormState,
} from "./form-state";
import { getProfileRpcErrorMessage } from "./rpc-errors";

function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

const SESSION_EXPIRED: ProfileFormState = {
  fieldErrors: {},
  message: "Tu sesión expiró. Vuelve a iniciar sesión.",
  status: "error",
};

export async function updateProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  if (!(await getAuthContext())) {
    return SESSION_EXPIRED;
  }

  // Only the editable fields are read; any extra form field is ignored.
  const parsed = profileUpdateSchema.safeParse({
    alias: text(formData, "alias"),
    avatarId: text(formData, "avatarId"),
    department: text(formData, "department"),
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      message: "Revisa los campos marcados.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_alias: parsed.data.alias,
    p_avatar_id: parsed.data.avatarId,
    p_department: parsed.data.department,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
  });

  if (error) {
    return {
      fieldErrors: error.code === "23505" ? { alias: "Ese alias ya está en uso." } : {},
      message: getProfileRpcErrorMessage(error),
      status: "error",
    };
  }

  revalidatePath("/app", "layout");

  return { fieldErrors: {}, message: "Perfil actualizado.", status: "success" };
}

export async function completeProfileAction(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  if (!(await getAuthContext())) {
    return SESSION_EXPIRED;
  }

  // The operational date is computed on the server; PostgreSQL re-checks it.
  const schema = createProfileCompletionSchema(getOperationalDate(new Date()));
  const parsed = schema.safeParse({
    acceptedPrivacy: formData.get("acceptedPrivacy") === "on",
    acceptedRules: formData.get("acceptedRules") === "on",
    ageDeclaration: text(formData, "ageDeclaration"),
    alias: text(formData, "alias"),
    avatarId: text(formData, "avatarId"),
    birthDate: text(formData, "birthDate"),
    department: text(formData, "department"),
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      message: "Revisa los campos marcados.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_my_profile", {
    p_accepted_privacy: parsed.data.acceptedPrivacy,
    p_accepted_rules: parsed.data.acceptedRules,
    p_age_declaration: parsed.data.ageDeclaration,
    p_alias: parsed.data.alias,
    p_avatar_id: parsed.data.avatarId,
    p_birth_date: parsed.data.birthDate,
    p_department: parsed.data.department,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
  });

  if (error) {
    return {
      fieldErrors: error.code === "23505" ? { alias: "Ese alias ya está en uso." } : {},
      message: getProfileRpcErrorMessage(error),
      status: "error",
    };
  }

  revalidatePath("/app", "layout");

  return { fieldErrors: {}, message: "Perfil completado.", status: "success" };
}
