"use client";

import { useState } from "react";

import { FieldError, SubmitButton, fieldClassName, labelClassName } from "@/components/admin/admin-ui";
import { Status, useTransitionForm } from "@/components/admin/campaign-forms";
import { isoToSalvadorLocal } from "@/lib/campaign/schemas";
import { regenerateCodeAction, saveMissionAction } from "@/lib/missions/actions";

export interface MissionFormValues {
  description: string;
  enabled: boolean;
  expires_at: string;
  id: string;
  name: string;
  points: number;
  starts_at: string;
}

export function MissionForm({ mission }: { mission: MissionFormValues | null }) {
  const { onSubmit, pending, state } = useTransitionForm(saveMissionAction);
  const errors = state.fieldErrors;
  // Computed once: new missions default to now → now + 6 h.
  const [defaults] = useState(() => ({
    expires: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    starts: new Date().toISOString(),
  }));

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Status state={state} />
      <input name="missionId" type="hidden" value={mission?.id ?? ""} />
      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <div>
          <label className={labelClassName} htmlFor="name">
            Nombre de la misión
          </label>
          <input className={fieldClassName} defaultValue={mission?.name} id="name" maxLength={120} name="name" placeholder="Estación MSI: prueba un portátil" />
          <FieldError id="name-error">{errors.name}</FieldError>
        </div>
        <div>
          <label className={labelClassName} htmlFor="points">
            Puntos
          </label>
          <input className={fieldClassName} defaultValue={mission?.points ?? 25} id="points" inputMode="numeric" name="points" />
          <FieldError id="points-error">{errors.points}</FieldError>
        </div>
      </div>
      <div>
        <label className={labelClassName} htmlFor="description">
          Descripción (la ve el participante al canjear)
        </label>
        <textarea className={`${fieldClassName} min-h-20`} defaultValue={mission?.description} id="description" maxLength={1000} name="description" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="startsAt">
            Inicio (hora SV)
          </label>
          <input className={fieldClassName} defaultValue={isoToSalvadorLocal(mission?.starts_at ?? defaults.starts)} id="startsAt" name="startsAt" type="datetime-local" />
          <FieldError id="startsAt-error">{errors.startsAt}</FieldError>
        </div>
        <div>
          <label className={labelClassName} htmlFor="expiresAt">
            Vencimiento (hora SV)
          </label>
          <input
            className={fieldClassName}
            defaultValue={isoToSalvadorLocal(mission?.expires_at ?? defaults.expires)}
            id="expiresAt"
            name="expiresAt"
            type="datetime-local"
          />
          <FieldError id="expiresAt-error">{errors.expiresAt}</FieldError>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input defaultChecked={mission?.enabled ?? true} name="enabled" type="checkbox" />
        Misión activa (desmárcala para pausar los canjes)
      </label>
      <SubmitButton className="sm:w-auto" pending={pending} pendingLabel="Guardando…" type="submit">
        {mission ? "Guardar cambios" : "Crear misión y generar código"}
      </SubmitButton>
    </form>
  );
}

export function RegenerateCodeForm({ missionId }: { missionId: string }) {
  const { onSubmit, pending, state } = useTransitionForm(regenerateCodeAction);

  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={(event) => {
        if (!window.confirm("¿Regenerar? El código y el QR actuales dejarán de funcionar.")) {
          event.preventDefault();
          return;
        }

        onSubmit(event);
      }}
    >
      <input name="missionId" type="hidden" value={missionId} />
      <Status state={state} />
      <button
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        Regenerar código (si se filtró)
      </button>
    </form>
  );
}
