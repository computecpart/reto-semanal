"use client";

import type { FormEvent } from "react";
import { startTransition, useActionState } from "react";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "@/components/auth/form-ui";
import { completeProfileAction } from "@/lib/profile/actions";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";
import { AGE_DECLARATIONS } from "@/lib/validation/profile";

import {
  AvatarPicker,
  ConsentFields,
  DepartmentSelect,
  NameAndAliasFields,
} from "./profile-fields";

export function ProfileCompletionForm({ operationalDate }: { operationalDate: string }) {
  const [state, formAction, pending] = useActionState(
    completeProfileAction,
    INITIAL_PROFILE_FORM_STATE,
  );
  const errors = state.fieldErrors;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form className="space-y-7" noValidate onSubmit={handleSubmit}>
      <FormStatus tone={state.status === "success" ? "success" : "error"}>
        {state.status === "idle" ? undefined : state.message}
      </FormStatus>

      <NameAndAliasFields errors={errors} />

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

      <p className="text-xs leading-5 text-slate-500">
        La fecha de nacimiento, la declaración de edad y los consentimientos no se pueden
        modificar después de completar el perfil.
      </p>

      <SubmitButton pending={pending} pendingLabel="Guardando…" type="submit">
        Completar perfil
      </SubmitButton>
    </form>
  );
}
