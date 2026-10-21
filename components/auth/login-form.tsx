"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { getAuthErrorMessage } from "@/lib/auth/browser-errors";
import { rememberVerificationEmail } from "@/lib/auth/verification-storage";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validation/profile";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "./form-ui";

export function LoginForm({
  initialNotice,
  nextPath,
}: {
  initialNotice?: string;
  nextPath: string;
}) {
  const router = useRouter();
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setEmailError("");

    const formData = new FormData(event.currentTarget);
    const rawEmail = formData.get("email");
    const password = formData.get("password");
    const parsedEmail = emailSchema.safeParse(rawEmail);

    if (!parsedEmail.success) {
      setEmailError(parsedEmail.error.issues[0]?.message ?? "Ingresa un correo válido.");
      return;
    }

    if (typeof password !== "string" || password.length === 0) {
      setFormError("Ingresa tu contraseña.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsedEmail.data,
      password,
    });

    if (error) {
      if (error.code === "email_not_confirmed") {
        rememberVerificationEmail(parsedEmail.data);
        router.push("/verificar-correo");
        return;
      }

      setFormError(getAuthErrorMessage(error));
      setPending(false);
      return;
    }

    // Refresh so Server Components re-render with the new session cookies.
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <FormStatus tone="success">{initialNotice}</FormStatus>
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

      <div>
        <div className="flex items-center justify-between gap-4">
          <label className={labelClassName} htmlFor="password">
            Contraseña
          </label>
          <Link className="text-sm font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline" href="/forgot-password">
            ¿La olvidaste?
          </Link>
        </div>
        <input
          autoComplete="current-password"
          className={fieldClassName}
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      <SubmitButton pending={pending} pendingLabel="Iniciando sesión…" type="submit">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}

