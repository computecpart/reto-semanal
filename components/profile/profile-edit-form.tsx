"use client";

import type { FormEvent } from "react";
import { startTransition, useActionState } from "react";

import { FormStatus, SubmitButton } from "@/components/auth/form-ui";
import { updateProfileAction } from "@/lib/profile/actions";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";
import type { MyProfile } from "@/lib/profile/my-profile";

import { AvatarPicker, DepartmentSelect, NameAndAliasFields } from "./profile-fields";

export function ProfileEditForm({ profile }: { profile: MyProfile }) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    INITIAL_PROFILE_FORM_STATE,
  );

  // Submitting through a transition keeps typed values after a failed attempt;
  // a bare form action would reset uncontrolled fields to their defaults.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="space-y-7" noValidate onSubmit={handleSubmit}>
      <FormStatus tone={state.status === "success" ? "success" : "error"}>
        {state.status === "idle" ? undefined : state.message}
      </FormStatus>

      <NameAndAliasFields
        defaults={{
          alias: profile.alias,
          firstName: profile.first_name,
          lastName: profile.last_name,
        }}
        errors={state.fieldErrors}
      />

      <DepartmentSelect defaultValue={profile.department} error={state.fieldErrors.department} />

      <AvatarPicker defaultValue={profile.avatar_id} error={state.fieldErrors.avatarId} />

      <SubmitButton pending={pending} pendingLabel="Guardando…" type="submit">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
