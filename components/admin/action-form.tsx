"use client";

import type { ReactNode } from "react";

import { Status, useTransitionForm } from "@/components/admin/campaign-forms";
import type { ProfileFormState } from "@/lib/profile/form-state";

type Action = (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;

/** Small admin form: server action + inline status + optional confirmation. */
export function ActionForm({
  action,
  children,
  className = "flex flex-wrap items-end gap-2",
  confirm,
  submitLabel,
  tone = "primary",
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
  submitLabel: string;
  tone?: "primary" | "danger";
}) {
  const { onSubmit, pending, state } = useTransitionForm(action);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }

        onSubmit(event);
      }}
    >
      <div className={className}>
        {children}
        <button
          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${tone === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-sky-700 hover:bg-sky-800"}`}
          disabled={pending}
          type="submit"
        >
          {pending ? "Procesando…" : submitLabel}
        </button>
      </div>
      <div className="mt-2">
        <Status state={state} />
      </div>
    </form>
  );
}
