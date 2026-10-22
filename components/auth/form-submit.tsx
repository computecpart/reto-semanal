"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { SubmitButton } from "./form-ui";

/** Submit button for server-action forms: disabled while the action runs. */
export function FormSubmit({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <SubmitButton pending={pending} pendingLabel={pendingLabel} type="submit">
      {children}
    </SubmitButton>
  );
}
