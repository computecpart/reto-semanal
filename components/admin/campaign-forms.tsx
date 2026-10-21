"use client";

import type { FormEvent } from "react";
import { startTransition, useActionState, useState } from "react";

import {
  FieldError,
  FormStatus,
  SubmitButton,
  fieldClassName,
  labelClassName,
} from "@/components/auth/form-ui";
import {
  type ActionState,
  createCampaignAction,
  publishRulesAction,
  setCampaignStatusAction,
  updateCampaignAction,
} from "@/lib/campaign/actions";
import { isoToSalvadorLocal } from "@/lib/campaign/schemas";
import {
  CAMPAIGN_STATUS_LABELS,
  getAllowedTransitions,
  type CampaignStatus,
} from "@/lib/campaign/status";
import { INITIAL_PROFILE_FORM_STATE } from "@/lib/profile/form-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Submitting through a transition keeps typed values after a failed attempt.
function useTransitionForm(action: FormAction) {
  const [state, formAction, pending] = useActionState(action, INITIAL_PROFILE_FORM_STATE);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { onSubmit, pending, state };
}

function Status({ state }: { state: ActionState }) {
  return (
    <FormStatus tone={state.status === "success" ? "success" : "error"}>
      {state.status === "idle" ? undefined : state.message}
    </FormStatus>
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateCampaignForm() {
  const { onSubmit, pending, state } = useTransitionForm(createCampaignAction);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="name">
            Nombre de la campaña
          </label>
          <input
            className={fieldClassName}
            id="name"
            maxLength={120}
            name="name"
            onChange={(event) => {
              if (!slugTouched) {
                setSlug(slugify(event.target.value));
              }
            }}
            placeholder="Reto Semanal 2026"
            required
          />
          <FieldError id="name-error">{state.fieldErrors.name}</FieldError>
        </div>
        <div>
          <label className={labelClassName} htmlFor="slug">
            Identificador (slug)
          </label>
          <input
            className={fieldClassName}
            id="slug"
            maxLength={60}
            name="slug"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
            spellCheck={false}
            value={slug}
          />
          <FieldError id="slug-error">{state.fieldErrors.slug}</FieldError>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Se crea en borrador con una portada de ejemplo que podrás editar sección por sección.
      </p>
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Creando…" type="submit">
        Crear campaña
      </SubmitButton>
    </form>
  );
}

export interface CampaignFormValues {
  ends_at: string | null;
  id: string;
  name: string;
  prize_description: string | null;
  prize_title: string | null;
  slug: string;
  starts_at: string | null;
  status: CampaignStatus;
}

export function CampaignDetailsForm({ campaign }: { campaign: CampaignFormValues }) {
  const { onSubmit, pending, state } = useTransitionForm(updateCampaignAction);
  const locked = campaign.status === "finalized" || campaign.status === "archived";
  const errors = state.fieldErrors;

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="campaignId" type="hidden" value={campaign.id} />
      <fieldset className="space-y-5" disabled={locked}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClassName} htmlFor="name">
              Nombre
            </label>
            <input className={fieldClassName} defaultValue={campaign.name} id="name" maxLength={120} name="name" required />
            <FieldError id="name-error">{errors.name}</FieldError>
          </div>
          <div>
            <label className={labelClassName} htmlFor="slug">
              Identificador (slug)
            </label>
            <input className={fieldClassName} defaultValue={campaign.slug} id="slug" maxLength={60} name="slug" required spellCheck={false} />
            <FieldError id="slug-error">{errors.slug}</FieldError>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClassName} htmlFor="startsAt">
              Inicio (hora de El Salvador)
            </label>
            <input className={fieldClassName} defaultValue={isoToSalvadorLocal(campaign.starts_at)} id="startsAt" name="startsAt" type="datetime-local" />
            <FieldError id="startsAt-error">{errors.startsAt}</FieldError>
          </div>
          <div>
            <label className={labelClassName} htmlFor="endsAt">
              Cierre (hora de El Salvador)
            </label>
            <input className={fieldClassName} defaultValue={isoToSalvadorLocal(campaign.ends_at)} id="endsAt" name="endsAt" type="datetime-local" />
            <FieldError id="endsAt-error">{errors.endsAt}</FieldError>
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="prizeTitle">
            Premio (título)
          </label>
          <input className={fieldClassName} defaultValue={campaign.prize_title ?? ""} id="prizeTitle" maxLength={160} name="prizeTitle" placeholder="PC gamer completa" />
          <FieldError id="prizeTitle-error">{errors.prizeTitle}</FieldError>
        </div>
        <div>
          <label className={labelClassName} htmlFor="prizeDescription">
            Premio (descripción)
          </label>
          <textarea className={`${fieldClassName} min-h-28`} defaultValue={campaign.prize_description ?? ""} id="prizeDescription" maxLength={2000} name="prizeDescription" />
          <FieldError id="prizeDescription-error">{errors.prizeDescription}</FieldError>
        </div>

        <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Guardando…" type="submit">
          Guardar datos
        </SubmitButton>
      </fieldset>
      {locked ? <p className="text-sm text-slate-600">Una campaña finalizada o archivada es de solo lectura.</p> : null}
    </form>
  );
}

export function CampaignStatusForm({ campaignId, status }: { campaignId: string; status: CampaignStatus }) {
  const { onSubmit, pending, state } = useTransitionForm(setCampaignStatusAction);
  const transitions = getAllowedTransitions(status);

  if (transitions.length === 0) {
    return <p className="text-sm text-slate-600">Este estado es definitivo.</p>;
  }

  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="campaignId" type="hidden" value={campaignId} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div>
          <label className={labelClassName} htmlFor="status">
            Nuevo estado
          </label>
          <select className={fieldClassName} defaultValue={transitions[0]} id="status" name="status">
            {transitions.map((next) => (
              <option key={next} value={next}>
                {CAMPAIGN_STATUS_LABELS[next]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName} htmlFor="reason">
            Motivo (queda en la auditoría)
          </label>
          <input className={fieldClassName} id="reason" maxLength={500} name="reason" placeholder="Opcional" />
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Publicar exige fechas, reglas publicadas y la portada publicada.
      </p>
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Aplicando…" type="submit">
        Cambiar estado
      </SubmitButton>
    </form>
  );
}

export function RulesPublishForm({
  campaignId,
  initialContent,
  isFirstVersion,
}: {
  campaignId: string;
  initialContent: string;
  isFirstVersion: boolean;
}) {
  const { onSubmit, pending, state } = useTransitionForm(publishRulesAction);

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="campaignId" type="hidden" value={campaignId} />
      <div>
        <label className={labelClassName} htmlFor="contentMd">
          Texto de las reglas (Markdown)
        </label>
        <textarea
          className={`${fieldClassName} min-h-96 font-mono text-sm`}
          defaultValue={initialContent}
          id="contentMd"
          maxLength={50000}
          name="contentMd"
          spellCheck
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Usa <code>##</code> para títulos, <code>-</code> para listas y <code>**texto**</code> para
          negritas. No se admite HTML.
        </p>
        <FieldError id="contentMd-error">{state.fieldErrors.contentMd}</FieldError>
      </div>
      <div>
        <label className={labelClassName} htmlFor="changeSummary">
          Resumen de cambios
        </label>
        <input className={fieldClassName} id="changeSummary" maxLength={500} name="changeSummary" placeholder={isFirstVersion ? "Primera versión" : "Qué cambió y por qué"} />
      </div>
      {isFirstVersion ? (
        <p className="text-sm text-slate-600">La primera versión siempre se considera importante.</p>
      ) : (
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input className="mt-1 size-4 accent-sky-700" name="isMajor" type="checkbox" />
          <span>
            <strong>Cambio importante:</strong> todos los participantes deberán aceptar esta versión
            antes de seguir usando la plataforma.
          </span>
        </label>
      )}
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Publicando…" type="submit">
        Publicar nueva versión
      </SubmitButton>
    </form>
  );
}
