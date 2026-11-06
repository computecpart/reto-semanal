"use client";

import { useActionState } from "react";

import { FormStatus, SubmitButton } from "@/components/auth/form-ui";
import { joinCampaignAction } from "@/lib/campaign/actions";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";

export function JoinCampaignForm({ campaignName, token }: { campaignName: string; token: string }) {
  const [state, formAction, pending] = useActionState(joinCampaignAction, INITIAL_PROFILE_FORM_STATE);

  // Only a hidden field, so a plain form action is safe.
  return (
    <form action={formAction} className="space-y-4">
      <input name="token" type="hidden" value={token} />
      <FormStatus>{state.status === "error" ? state.message : undefined}</FormStatus>
      <SubmitButton pending={pending} pendingLabel="Uniéndote…" type="submit">
        Acepto las reglas y me uno a {campaignName}
      </SubmitButton>
    </form>
  );
}
