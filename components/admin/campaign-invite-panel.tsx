"use client";

import { useState } from "react";

import { ActionForm } from "@/components/admin/action-form";
import {
  regenerateCampaignInviteAction,
  setCampaignInviteAction,
  setCampaignPrivateAction,
} from "@/lib/campaign/actions";
import type { AdminCampaign } from "@/lib/campaign/queries";

const button = "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold";

function Hidden({ name, value }: { name: string; value: string }) {
  return <input name={name} type="hidden" value={value} />;
}

/** Campaign type and, for private campaigns, the link shared by WhatsApp. */
export function CampaignInvitePanel({
  campaign,
  members,
  origin,
}: {
  campaign: AdminCampaign;
  members: number;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);
  const draft = campaign.status === "draft";

  if (!campaign.is_private) {
    return (
      <div className="space-y-3 text-sm text-slate-600">
        <p>Campaña pública: su portada se muestra en la página principal y solo puede haber una publicada.</p>
        {draft ? (
          <ActionForm action={setCampaignPrivateAction} submitLabel="Convertir en campaña privada">
            <Hidden name="campaignId" value={campaign.id} />
            <Hidden name="isPrivate" value="true" />
          </ActionForm>
        ) : null}
      </div>
    );
  }

  const link = `${origin.replace(/\/$/, "")}/unirse/${campaign.invite_token ?? ""}`;
  const message = `Te invito a ${campaign.name}: ${link}`;
  const live = campaign.status === "published" && campaign.invite_enabled;

  return (
    <div className="space-y-4 text-sm">
      <p className="text-slate-600">
        Campaña privada: funciona al mismo tiempo que la principal, en <code className="font-mono">/c/{campaign.slug}</code>.
        Cualquiera con este enlace puede unirse, participe o no en la campaña principal.{" "}
        <strong className="text-slate-900">
          {members} {members === 1 ? "persona se ha unido" : "personas se han unido"}.
        </strong>
      </p>

      {!live ? (
        <p className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-900">
          {campaign.status === "published"
            ? "El enlace está pausado: nadie nuevo puede unirse."
            : "El enlace funcionará cuando publiques la campaña: en «Estado», más abajo, elige «Publicada»."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Enlace de invitación"
          className="min-h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs sm:w-auto sm:min-w-0 sm:flex-1"
          onFocus={(event) => event.target.select()}
          readOnly
          value={link}
        />
        <button
          className={`${button} border-slate-300 bg-white hover:bg-slate-50`}
          onClick={() => {
            void navigator.clipboard.writeText(link).then(() => setCopied(true));
          }}
          type="button"
        >
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
        <a
          className={`${button} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`}
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Compartir por WhatsApp
        </a>
      </div>

      <div className="flex flex-wrap gap-3">
        <ActionForm action={setCampaignInviteAction} submitLabel={campaign.invite_enabled ? "Pausar enlace" : "Reactivar enlace"}>
          <Hidden name="campaignId" value={campaign.id} />
          <Hidden name="enabled" value={String(!campaign.invite_enabled)} />
        </ActionForm>
        <ActionForm
          action={regenerateCampaignInviteAction}
          confirm="El enlace actual dejará de funcionar. Quienes ya se unieron siguen dentro. ¿Crear uno nuevo?"
          submitLabel="Crear enlace nuevo"
          tone="danger"
        >
          <Hidden name="campaignId" value={campaign.id} />
        </ActionForm>
        {draft ? (
          <ActionForm
            action={setCampaignPrivateAction}
            confirm="Una campaña pública ocupa la portada principal y no se puede publicar mientras otra pública siga publicada. Para que funcione junto a la principal debe seguir siendo privada. ¿Cambiarla a pública de todos modos?"
            submitLabel="Cambiar a campaña pública"
          >
            <Hidden name="campaignId" value={campaign.id} />
            <Hidden name="isPrivate" value="false" />
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
