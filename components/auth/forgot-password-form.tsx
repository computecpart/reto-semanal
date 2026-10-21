"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";

import { getAuthErrorMessage } from "@/lib/auth/browser-errors";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validation/profile";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "./form-ui";

export function ForgotPasswordForm({ callbackError = false }: { callbackError?: boolean }) {
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState(
    callbackError ? "El enlace no es válido o ya expiró. Solicita uno nuevo." : "",
  );
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setFormError("");

    const formData = new FormData(event.currentTarget);
    const parsedEmail = emailSchema.safeParse(formData.get("email"));

    if (!parsedEmail.success) {
      setEmailError(parsedEmail.error.issues[0]?.message ?? "Ingresa un correo válido.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setFormError(
        getAuthErrorMessage(
          error,
          "No fue posible enviar el correo. Espera un momento e inténtalo de nuevo.",
        ),
      );
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <FormStatus tone="success">
          Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.
        </FormStatus>
        <p className="text-sm leading-6 text-slate-600">
          Revisa también la carpeta de correo no deseado. El enlace es de un solo uso y puede expirar.
        </p>
        <Link
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-800"
          href="/login"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <FormStatus>{formError}</FormStatus>

      <div>
        <label className={labelClassName} htmlFor="email">
          Correo electrónico
        </label>
        <input
          aria-describedby="email-error"
          aria-invalid={Boolean(emailError)}
          autoCapitalize="none"
          autoComplete="email"
          className={fieldClassName}
          id="email"
          inputMode="email"
          name="email"
          required
          spellCheck={false}
          type="email"
        />
        <FieldError id="email-error">{emailError}</FieldError>
      </div>

      <SubmitButton pending={pending} pendingLabel="Enviando enlace…" type="submit">
        Enviar enlace de recuperación
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        <Link className="font-semibold text-sky-800 hover:underline" href="/login">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}

