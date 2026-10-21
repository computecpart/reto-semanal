"use client";

import type { FormEvent } from "react";
import { startTransition, useActionState } from "react";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  checkboxClassName,
  fieldClassName,
  labelClassName,
} from "@/components/auth/form-ui";
import { updateContactAction } from "@/lib/profile/actions";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";
import { formatSalvadorPhone } from "@/lib/validation/profile";

export function ContactForm({
  marketingConsent,
  phone,
}: {
  marketingConsent: boolean;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateContactAction, INITIAL_PROFILE_FORM_STATE);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <FormStatus tone={state.status === "success" ? "success" : "error"}>
        {state.status === "idle" ? undefined : state.message}
      </FormStatus>

      <div>
        <label className={labelClassName} htmlFor="phone">
          Teléfono
        </label>
        <input
          aria-describedby="phone-error"
          aria-invalid={Boolean(state.fieldErrors.phone)}
          autoComplete="tel-national"
          className={fieldClassName}
          defaultValue={formatSalvadorPhone(phone)}
          id="phone"
          inputMode="tel"
          maxLength={20}
          name="phone"
          placeholder="7123-4567"
          required
          type="tel"
        />
        <FieldError id="phone-error">{state.fieldErrors.phone}</FieldError>
      </div>

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input className={checkboxClassName} defaultChecked={marketingConsent} name="marketingConsent" type="checkbox" />
        <span>Acepto recibir comunicaciones comerciales de los organizadores (opcional).</span>
      </label>

      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Guardando…" type="submit">
        Guardar contacto
      </SubmitButton>
    </form>
  );
}
