"use client";

import { useState } from "react";

import { FieldError, SubmitButton, fieldClassName, labelClassName } from "@/components/admin/admin-ui";
import { Status, useTransitionForm } from "@/components/admin/campaign-forms";
import { adjustPointsAction, reversePointEventAction, updateRankingSettingsAction } from "@/lib/points/actions";
import {
  RANKING_AUDIENCE_LABELS,
  RANKING_AUDIENCES,
  RANKING_IDENTITIES,
  RANKING_IDENTITY_LABELS,
  type RankingAudience,
  type RankingIdentity,
} from "@/lib/points/config";

export function RankingSettingsForm({
  audience,
  campaignId,
  highlightTop,
  identity,
  visible,
}: {
  audience: RankingAudience;
  campaignId: string;
  highlightTop: number;
  identity: RankingIdentity;
  visible: boolean;
}) {
  const { onSubmit, pending, state } = useTransitionForm(updateRankingSettingsAction);

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="campaignId" type="hidden" value={campaignId} />
      <label className="flex items-start gap-3 text-sm text-slate-800">
        <input className="mt-1 size-4 accent-sky-700" defaultChecked={visible} name="visible" type="checkbox" />
        <span>
          <strong>Ranking visible</strong> para los participantes.
        </span>
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="audience">
            Audiencia
          </label>
          <select className={fieldClassName} defaultValue={audience} id="audience" name="audience">
            {RANKING_AUDIENCES.map((value) => (
              <option key={value} value={value}>
                {RANKING_AUDIENCE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClassName} htmlFor="identity">
            Identidad mostrada
          </label>
          <select className={fieldClassName} defaultValue={identity} id="identity" name="identity">
            {RANKING_IDENTITIES.map((value) => (
              <option key={value} value={value}>
                {RANKING_IDENTITY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-w-48">
        <label className={labelClassName} htmlFor="highlightTop">
          Destacar el Top
        </label>
        <input className={fieldClassName} defaultValue={highlightTop} id="highlightTop" max={20} min={0} name="highlightTop" type="number" />
        <FieldError id="highlightTop-error">{state.fieldErrors.highlightTop}</FieldError>
      </div>
      <p className="text-xs text-slate-500">
        Nunca se muestran correo, fecha de nacimiento, edad ni departamento.
      </p>
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Guardando…" type="submit">
        Guardar configuración
      </SubmitButton>
    </form>
  );
}

export function PointAdjustmentForm({
  campaignId,
  participants,
}: {
  campaignId: string;
  participants: readonly { alias: string; passport_code: string; user_id: string }[];
}) {
  const { onSubmit, pending, state } = useTransitionForm(adjustPointsAction);
  const errors = state.fieldErrors;

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="campaignId" type="hidden" value={campaignId} />
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className={labelClassName} htmlFor="userId">
            Participante
          </label>
          <select className={fieldClassName} defaultValue="" id="userId" name="userId">
            <option disabled value="">
              Selecciona un participante
            </option>
            {participants.map((participant) => (
              <option key={participant.user_id} value={participant.user_id}>
                @{participant.alias} · {participant.passport_code}
              </option>
            ))}
          </select>
          <FieldError id="userId-error">{errors.userId}</FieldError>
        </div>
        <div>
          <label className={labelClassName} htmlFor="amount">
            Puntos (±)
          </label>
          <input className={fieldClassName} id="amount" inputMode="numeric" name="amount" placeholder="25 o -10" />
          <FieldError id="amount-error">{errors.amount}</FieldError>
        </div>
      </div>
      <div>
        <label className={labelClassName} htmlFor="description">
          Descripción visible para el participante
        </label>
        <input className={fieldClassName} id="description" maxLength={200} name="description" placeholder="Misión presencial: estación MSI" />
      </div>
      <div>
        <label className={labelClassName} htmlFor="reason">
          Motivo interno (obligatorio, queda en la auditoría)
        </label>
        <textarea className={`${fieldClassName} min-h-20`} id="reason" maxLength={500} name="reason" />
        <FieldError id="reason-error">{errors.reason}</FieldError>
      </div>
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Registrando…" type="submit">
        Registrar ajuste
      </SubmitButton>
    </form>
  );
}

export function ReverseEventForm({ campaignId, eventId }: { campaignId: string; eventId: number }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, state } = useTransitionForm(reversePointEventAction);

  if (state.status === "success") {
    return <span className="text-xs font-semibold text-emerald-700">Revertido</span>;
  }

  if (!open) {
    return (
      <button className="inline-flex min-h-9 items-center rounded-md border border-red-200 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => setOpen(true)} type="button">
        Revertir
      </button>
    );
  }

  return (
    <form className="flex flex-wrap items-start gap-2" noValidate onSubmit={onSubmit}>
      <input name="campaignId" type="hidden" value={campaignId} />
      <input name="eventId" type="hidden" value={eventId} />
      <input
        aria-label="Motivo de la reversión"
        className="min-w-48 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
        name="reason"
        placeholder="Motivo (mín. 10 caracteres)"
      />
      <button className="rounded-md bg-red-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">
        Confirmar
      </button>
      {state.status === "error" ? <p className="w-full text-xs text-red-700">{state.message}</p> : null}
    </form>
  );
}
