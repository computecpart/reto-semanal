import Image from "next/image";
import Link from "next/link";

import { FieldError, fieldClassName, labelClassName } from "@/components/auth/form-ui";
import { AVATARS } from "@/lib/avatars";
import { EL_SALVADOR_DEPARTMENTS } from "@/lib/validation/profile";

export function AvatarPicker({
  defaultValue,
  error,
}: {
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <fieldset aria-describedby="avatarId-help avatarId-error">
      <legend className={labelClassName}>Avatar</legend>
      <p className="mt-1.5 text-xs leading-5 text-slate-500" id="avatarId-help">
        Elige uno de los avatares oficiales. En esta versión no se permiten fotografías.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {AVATARS.map((avatar) => (
          <label className="cursor-pointer" key={avatar.id}>
            <input
              className="peer sr-only"
              defaultChecked={defaultValue === avatar.id}
              name="avatarId"
              required
              type="radio"
              value={avatar.id}
            />
            <span className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 text-center text-xs font-semibold text-slate-700 transition hover:border-sky-300 peer-checked:border-sky-700 peer-checked:bg-sky-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-700">
              <Image
                alt=""
                className="rounded-lg [image-rendering:pixelated]"
                height={64}
                src={avatar.src}
                unoptimized
                width={64}
              />
              {avatar.label}
            </span>
          </label>
        ))}
      </div>
      <FieldError id="avatarId-error">{error}</FieldError>
    </fieldset>
  );
}

export function DepartmentSelect({
  defaultValue,
  error,
}: {
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <div>
      <label className={labelClassName} htmlFor="department">
        Departamento de El Salvador
      </label>
      <select
        aria-describedby="department-error"
        aria-invalid={Boolean(error)}
        className={fieldClassName}
        defaultValue={defaultValue ?? ""}
        id="department"
        name="department"
        required
      >
        <option disabled value="">
          Selecciona tu departamento
        </option>
        {EL_SALVADOR_DEPARTMENTS.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </select>
      <FieldError id="department-error">{error}</FieldError>
    </div>
  );
}

export function NameAndAliasFields({
  defaults,
  errors,
}: {
  defaults?: { alias?: string | null; firstName?: string | null; lastName?: string | null };
  errors: Partial<Record<string, string>>;
}) {
  return (
    <>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Identidad</legend>

        <div>
          <label className={labelClassName} htmlFor="firstName">
            Nombre
          </label>
          <input
            aria-describedby="firstName-error"
            aria-invalid={Boolean(errors.firstName)}
            autoComplete="given-name"
            className={fieldClassName}
            defaultValue={defaults?.firstName ?? undefined}
            id="firstName"
            maxLength={80}
            name="firstName"
            required
          />
          <FieldError id="firstName-error">{errors.firstName}</FieldError>
        </div>

        <div>
          <label className={labelClassName} htmlFor="lastName">
            Apellido
          </label>
          <input
            aria-describedby="lastName-error"
            aria-invalid={Boolean(errors.lastName)}
            autoComplete="family-name"
            className={fieldClassName}
            defaultValue={defaults?.lastName ?? undefined}
            id="lastName"
            maxLength={80}
            name="lastName"
            required
          />
          <FieldError id="lastName-error">{errors.lastName}</FieldError>
        </div>
      </fieldset>

      <div>
        <label className={labelClassName} htmlFor="alias">
          Alias público
        </label>
        <input
          aria-describedby="alias-help alias-error"
          aria-invalid={Boolean(errors.alias)}
          autoCapitalize="none"
          autoComplete="nickname"
          className={fieldClassName}
          defaultValue={defaults?.alias ?? undefined}
          id="alias"
          maxLength={24}
          minLength={3}
          name="alias"
          required
          spellCheck={false}
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500" id="alias-help">
          Entre 3 y 24 caracteres: letras, números, guiones y guiones bajos. Sin enlaces, HTML
          ni términos administrativos.
        </p>
        <FieldError id="alias-error">{errors.alias}</FieldError>
      </div>
    </>
  );
}

export function ConsentFields({ errors }: { errors: Partial<Record<string, string>> }) {
  const linkClassName = "font-semibold text-sky-800 underline hover:text-sky-950";

  // New tab so reading the documents never discards a half-filled form.
  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Consentimientos</legend>

      <div>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input className="mt-1 size-4 accent-sky-700" name="acceptedRules" type="checkbox" />
          <span>
            Acepto las{" "}
            <Link className={linkClassName} href="/reglas" rel="noopener" target="_blank">
              reglas de participación
            </Link>{" "}
            de la campaña.
          </span>
        </label>
        <FieldError id="acceptedRules-error">{errors.acceptedRules}</FieldError>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input className="mt-1 size-4 accent-sky-700" name="acceptedPrivacy" type="checkbox" />
          <span>
            Acepto la{" "}
            <Link className={linkClassName} href="/privacidad" rel="noopener" target="_blank">
              política de privacidad
            </Link>{" "}
            y el tratamiento de mis datos para la campaña.
          </span>
        </label>
        <FieldError id="acceptedPrivacy-error">{errors.acceptedPrivacy}</FieldError>
      </div>
    </fieldset>
  );
}
