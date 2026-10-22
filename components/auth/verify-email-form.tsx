"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { getAuthErrorMessage } from "@/lib/auth/browser-errors";
import {
  forgetVerificationEmail,
  readOtpResendAt,
  readVerificationEmail,
  rememberVerificationEmail,
  startOtpResendCooldown,
} from "@/lib/auth/verification-storage";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validation/profile";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "./form-ui";

// Supabase lets the project choose an email OTP length between 6 and 10.
const OTP_PATTERN = /^\d{6,10}$/;

// sessionStorage does not notify same-tab writes, so there is nothing to
// subscribe to; the snapshot is read once on hydration.
function subscribeToNothing(): () => void {
  return () => {};
}

function secondsUntil(timestamp: number, now: number): number {
  return Math.max(0, Math.ceil((timestamp - now) / 1_000));
}

export function VerifyEmailForm({ linkError = false }: { linkError?: boolean }) {
  const router = useRouter();
  const storedEmail = useSyncExternalStore(subscribeToNothing, readVerificationEmail, () => "");
  const storedResendAt = useSyncExternalStore(subscribeToNothing, readOtpResendAt, () => 0);

  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [resendAtOverride, setResendAtOverride] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [emailError, setEmailError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [status, setStatus] = useState(
    linkError ? "El enlace de confirmación expiró o ya se usó. Solicita un código nuevo." : "",
  );
  const [statusTone, setStatusTone] = useState<"error" | "success" | "info">(
    linkError ? "error" : "info",
  );
  const [pendingAction, setPendingAction] = useState<"verify" | "resend" | null>(null);

  const email = emailDraft ?? storedEmail;
  const resendAt = resendAtOverride ?? storedResendAt;
  const remainingSeconds = secondsUntil(resendAt, now);

  useEffect(() => {
    if (resendAt <= Date.now()) {
      return;
    }

    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= resendAt) {
        window.clearInterval(interval);
      }
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [resendAt]);

  function restartCooldown() {
    setResendAtOverride(startOtpResendCooldown());
    setNow(Date.now());
  }

  function getValidEmail(): string | null {
    const parsed = emailSchema.safeParse(email);

    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Ingresa un correo válido.");
      return null;
    }

    setEmailError("");
    return parsed.data;
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setTokenError("");

    const validEmail = getValidEmail();
    const formData = new FormData(event.currentTarget);
    const rawToken = formData.get("token");
    const token = typeof rawToken === "string" ? rawToken.replace(/\s+/g, "") : "";

    if (!OTP_PATTERN.test(token)) {
      setTokenError("Ingresa el código numérico que recibiste por correo.");
      return;
    }

    if (!validEmail) {
      return;
    }

    setPendingAction("verify");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: validEmail,
      token,
      type: "email",
    });

    if (error) {
      setStatusTone("error");
      setStatus(getAuthErrorMessage(error, "No fue posible verificar el código."));
      setPendingAction(null);
      return;
    }

    // A verified OTP creates the session; the profile page renders server-side.
    forgetVerificationEmail();
    router.replace("/app/perfil");
    router.refresh();
  }

  async function handleResend() {
    if (remainingSeconds > 0 || pendingAction) {
      return;
    }

    setStatus("");
    const validEmail = getValidEmail();

    if (!validEmail) {
      return;
    }

    setPendingAction("resend");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      email: validEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
      type: "signup",
    });

    if (error) {
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        restartCooldown();
      }

      setStatusTone("error");
      setStatus(getAuthErrorMessage(error, "No fue posible reenviar el código."));
      setPendingAction(null);
      return;
    }

    rememberVerificationEmail(validEmail);
    restartCooldown();
    setStatusTone("success");
    setStatus("Si la cuenta está pendiente de verificación, recibirás un código nuevo.");
    setPendingAction(null);
  }

  return (
    <form className="space-y-6" noValidate onSubmit={handleVerify}>
      <FormStatus tone={statusTone}>{status}</FormStatus>

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
          onChange={(event) => setEmailDraft(event.target.value)}
          required
          spellCheck={false}
          type="email"
          value={email}
        />
        <FieldError id="email-error">{emailError}</FieldError>
      </div>

      <div>
        <label className={labelClassName} htmlFor="token">
          Código de verificación
        </label>
        <input
          aria-describedby="token-help token-error"
          aria-invalid={Boolean(tokenError)}
          autoComplete="one-time-code"
          className={`${fieldClassName} text-center font-mono text-2xl tracking-[0.35em]`}
          id="token"
          inputMode="numeric"
          maxLength={10}
          name="token"
          pattern="[0-9]{6,10}"
          required
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500" id="token-help">
          Escribe el código numérico enviado por correo. Si en lugar de un código recibiste un
          enlace, ábrelo en este mismo navegador. Nunca compartas el código ni el enlace.
        </p>
        <FieldError id="token-error">{tokenError}</FieldError>
      </div>

      <SubmitButton
        pending={pendingAction === "verify"}
        pendingLabel="Verificando…"
        type="submit"
      >
        Verificar correo
      </SubmitButton>

      <div className="border-2 border-dashed border-slate-300 bg-[var(--color-paper)] p-4 text-center text-sm text-slate-600">
        <p>¿No recibiste el correo?</p>
        <button
          className="mt-1 inline-flex min-h-10 items-center font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
          disabled={remainingSeconds > 0 || pendingAction !== null}
          onClick={handleResend}
          type="button"
        >
          {pendingAction === "resend"
            ? "Reenviando…"
            : remainingSeconds > 0
              ? `Podrás reenviar en ${remainingSeconds} s`
              : "Reenviar código"}
        </button>
      </div>

      <p className="text-center text-sm text-slate-600">
        <Link className="font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline" href="/login">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
