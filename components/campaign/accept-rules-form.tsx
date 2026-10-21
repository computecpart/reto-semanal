"use client";

import { useActionState } from "react";

import { FormStatus, SubmitButton } from "@/components/auth/form-ui";
import { acceptRulesAction } from "@/lib/campaign/actions";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";

export function AcceptRulesForm({ version }: { version: number }) {
  const [state, formAction, pending] = useActionState(acceptRulesAction, INITIAL_PROFILE_FORM_STATE);

  // No uncontrolled fields here, so a plain form action is safe.
  return (
    <form action={formAction} className="space-y-4">
      <FormStatus>{state.status === "error" ? state.message : undefined}</FormStatus>
      <SubmitButton pending={pending} pendingLabel="Registrando…" type="submit">
        Acepto las reglas (versión {version})
      </SubmitButton>
    </form>
  );
}
