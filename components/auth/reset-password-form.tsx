"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { getAuthErrorMessage } from "@/lib/auth/browser-errors";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validation/profile";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "./form-ui";

export function ResetPasswordForm() {
  const router = useRouter();
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setConfirmPasswordError("");
    setFormError("");

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    const parsedPassword = passwordSchema.safeParse(password);

    if (!parsedPassword.success) {
      setPasswordError(
        parsedPassword.error.issues[0]?.message ?? "La contraseña no es válida.",
      );
      return;
    }

    if (confirmPassword !== parsedPassword.data) {
      setConfirmPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsedPassword.data,
    });

    if (error) {
      setFormError(getAuthErrorMessage(error, "No fue posible actualizar la contraseña."));
      setPending(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });

    if (signOutError) {
      setFormError(
        "La contraseña se actualizó, pero no fue posible cerrar esta sesión. Cierra la pestaña antes de continuar.",
      );
      setPending(false);
      return;
    }

    router.replace("/login?password=updated");
    router.refresh();
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleSubmit}>
      <FormStatus>{formError}</FormStatus>

      <div>
        <label className={labelClassName} htmlFor="password">
          Contraseña nueva
        </label>
        <input
          aria-describedby="password-help password-error"
          aria-invalid={Boolean(passwordError)}
          autoComplete="new-password"
          className={fieldClassName}
          id="password"
          maxLength={128}
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500" id="password-help">
          Debe tener entre 8 y 128 caracteres y ser distinta de tus contraseñas fáciles de adivinar.
        </p>
        <FieldError id="password-error">{passwordError}</FieldError>
      </div>

      <div>
        <label className={labelClassName} htmlFor="confirmPassword">
          Confirmar contraseña nueva
        </label>
        <input
          aria-describedby="confirmPassword-error"
          aria-invalid={Boolean(confirmPasswordError)}
          autoComplete="new-password"
          className={fieldClassName}
          id="confirmPassword"
          maxLength={128}
          minLength={8}
          name="confirmPassword"
          required
          type="password"
        />
        <FieldError id="confirmPassword-error">{confirmPasswordError}</FieldError>
      </div>

      <SubmitButton pending={pending} pendingLabel="Actualizando…" type="submit">
        Guardar contraseña nueva
      </SubmitButton>
    </form>
  );
}

