"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  AvatarPicker,
  ConsentFields,
  DepartmentSelect,
  NameAndAliasFields,
} from "@/components/profile/profile-fields";
import { getAuthErrorMessage } from "@/lib/auth/browser-errors";
import {
  rememberVerificationEmail,
  startOtpResendCooldown,
} from "@/lib/auth/verification-storage";
import { collectFieldErrors } from "@/lib/profile/form-state";
import { createClient } from "@/lib/supabase/client";
import {
  AGE_DECLARATIONS,
  createRegistrationSchema,
  type RegistrationInput,
} from "@/lib/validation/profile";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "./form-ui";

type RegistrationField = keyof RegistrationInput;
type RegistrationErrors = Partial<Record<string, string>>;

function value(formData: FormData, name: RegistrationField): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

export function RegistrationForm({ operationalDate }: { operationalDate: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const formData = new FormData(event.currentTarget);
    // Raw, untrusted form values; the schema decides what is valid.
    const input: Record<RegistrationField, unknown> = {
      acceptedPrivacy: formData.get("acceptedPrivacy") === "on",
      acceptedRules: formData.get("acceptedRules") === "on",
      ageDeclaration: value(formData, "ageDeclaration"),
      alias: value(formData, "alias"),
      avatarId: value(formData, "avatarId"),
      birthDate: value(formData, "birthDate"),
      confirmPassword: value(formData, "confirmPassword"),
      department: value(formData, "department"),
      email: value(formData, "email"),
      firstName: value(formData, "firstName"),
      lastName: value(formData, "lastName"),
      marketingConsent: formData.get("marketingConsent") === "on",
      phone: value(formData, "phone"),
      password: value(formData, "password"),
    };

    const parsed = createRegistrationSchema(operationalDate).safeParse(input);

    if (!parsed.success) {
      setErrors(collectFieldErrors(parsed.error.issues));
      setFormError("Revisa los campos marcados antes de continuar.");
      return;
    }

    setErrors({});
    setPending(true);

    const data = parsed.data;
    const supabase = createClient();

    // UX pre-check only; the unique index in PostgreSQL remains the authority.
    const { data: aliasAvailable, error: aliasError } = await supabase.rpc(
      "is_alias_available",
      { p_alias: data.alias },
    );

    if (!aliasError && aliasAvailable === false) {
      setErrors({ alias: "Ese alias ya está en uso o no está permitido." });
      setFormError("Revisa los campos marcados antes de continuar.");
      setPending(false);
      return;
    }

    // Metadata only seeds the profile row; the role is always created as
    // participant by the database trigger and never read from metadata.
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          accepted_privacy: data.acceptedPrivacy,
          accepted_rules: data.acceptedRules,
          age_declaration: data.ageDeclaration,
          alias: data.alias,
          avatar_id: data.avatarId,
          birth_date: data.birthDate,
          department: data.department,
          first_name: data.firstName,
          last_name: data.lastName,
          marketing_consent: data.marketingConsent,
          phone: data.phone,
        },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      // The profile trigger aborts the sign-up (HTTP 500) on a lost alias race
      // or data PostgreSQL rejects.
      setFormError(
        error.status === 500
          ? "No fue posible crear la cuenta. Es posible que el alias ya esté en uso; prueba con otro."
          : getAuthErrorMessage(
              error,
              "No fue posible crear la cuenta. Revisa los datos e inténtalo de nuevo.",
            ),
      );
      setPending(false);
      return;
    }

    rememberVerificationEmail(data.email);
    startOtpResendCooldown();
    router.push("/verificar-correo");
  }

  return (
    <form className="space-y-7" noValidate onSubmit={handleSubmit}>
      <FormStatus>{formError}</FormStatus>

      <NameAndAliasFields errors={errors} />

      <div>
        <label className={labelClassName} htmlFor="email">
          Correo electrónico
        </label>
        <input
          aria-describedby="email-error"
          aria-invalid={Boolean(errors.email)}
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
        <FieldError id="email-error">{errors.email}</FieldError>
      </div>

      <div>
        <label className={labelClassName} htmlFor="phone">
          Teléfono
        </label>
        <input
          aria-describedby="phone-help phone-error"
          aria-invalid={Boolean(errors.phone)}
          autoComplete="tel-national"
          className={fieldClassName}
          id="phone"
          inputMode="tel"
          maxLength={20}
          name="phone"
          placeholder="7123-4567"
          required
          type="tel"
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500" id="phone-help">
          Número de El Salvador. Solo se usa para contactarte si ganas.
        </p>
        <FieldError id="phone-error">{errors.phone}</FieldError>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Contraseña</legend>

        <div>
          <label className={labelClassName} htmlFor="password">
            Contraseña
          </label>
          <input
            aria-describedby="password-help password-error"
            aria-invalid={Boolean(errors.password)}
            autoComplete="new-password"
            className={fieldClassName}
            id="password"
            maxLength={128}
            name="password"
            required
            type="password"
          />
          <p className="mt-1.5 text-xs leading-5 text-slate-500" id="password-help">
            Mínimo 8 caracteres. Usa una contraseña larga, única y difícil de adivinar.
          </p>
          <FieldError id="password-error">{errors.password}</FieldError>
        </div>

        <div>
          <label className={labelClassName} htmlFor="confirmPassword">
            Confirmar contraseña
          </label>
          <input
            aria-describedby="confirmPassword-error"
            aria-invalid={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
            className={fieldClassName}
            id="confirmPassword"
            maxLength={128}
            name="confirmPassword"
            required
            type="password"
          />
          <FieldError id="confirmPassword-error">{errors.confirmPassword}</FieldError>
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Edad</legend>

        <div>
          <label className={labelClassName} htmlFor="birthDate">
            Fecha de nacimiento
          </label>
          <input
            aria-describedby="birthDate-error"
            aria-invalid={Boolean(errors.birthDate)}
            autoComplete="bday"
            className={fieldClassName}
            id="birthDate"
            max={operationalDate}
            name="birthDate"
            required
            type="date"
          />
          <FieldError id="birthDate-error">{errors.birthDate}</FieldError>
        </div>

        <div>
          <label className={labelClassName} htmlFor="ageDeclaration">
            Declaración de edad
          </label>
          <select
            aria-describedby="ageDeclaration-error"
            aria-invalid={Boolean(errors.ageDeclaration)}
            className={fieldClassName}
            defaultValue=""
            id="ageDeclaration"
            name="ageDeclaration"
            required
          >
            <option disabled value="">
              Selecciona una opción
            </option>
            {AGE_DECLARATIONS.map((declaration) => (
              <option key={declaration} value={declaration}>
                {declaration === "adult" ? "Soy mayor de edad" : "Soy menor de edad"}
              </option>
            ))}
          </select>
          <FieldError id="ageDeclaration-error">{errors.ageDeclaration}</FieldError>
        </div>
      </fieldset>

      <DepartmentSelect error={errors.department} />

      <AvatarPicker error={errors.avatarId} />

      <ConsentFields errors={errors} />

      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input className="mt-1 size-4 shrink-0 accent-[var(--accent)]" name="marketingConsent" type="checkbox" />
        <span>(Opcional) Acepto recibir comunicaciones comerciales de los organizadores.</span>
      </label>

      <SubmitButton pending={pending} pendingLabel="Creando cuenta…" type="submit">
        Crear cuenta
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        ¿Ya tienes una cuenta?{" "}
        <Link className="font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline" href="/login">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
