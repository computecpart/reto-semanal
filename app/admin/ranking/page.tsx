import type { Metadata } from "next";
import Link from "next/link";

import { PointAdjustmentForm, RankingSettingsForm, ReverseEventForm } from "@/components/admin/ranking-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaigns } from "@/lib/campaign/queries";
import { formatPoints, POINT_KIND_LABELS } from "@/lib/points/config";
import { getAdminRankingConfig, getAdminRecentEvents, getAdminStandings } from "@/lib/points/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Ranking y puntos | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});
const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Activo",
  archived: "Archivado",
  disqualified: "Descalificado",
  suspended: "Suspendido",
};

export default async function AdminRankingPage() {
  await requireAdminPage();
  const campaigns = await getAdminCampaigns();
  const campaign = campaigns.find((item) => item.status === "published") ?? campaigns[0];

  if (!campaign) {
    return (
      <section className={card}>
        <h1 className="text-2xl font-bold">Ranking y puntos</h1>
        <p className="mt-2 text-sm text-slate-600">
          Crea una campaña primero.{" "}
          <Link className="font-semibold text-sky-800 underline" href="/admin/campana">
            Ir a campañas
          </Link>
        </p>
      </section>
    );
  }

  const [config, standings, events] = await Promise.all([
    getAdminRankingConfig(campaign.id),
    getAdminStandings(campaign.id),
    getAdminRecentEvents(campaign.id),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">{campaign.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Ranking y puntos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Orden: puntos, luego respuestas correctas y luego eventos completados. Los empates restantes
          se resuelven con la pregunta supervisada.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={card}>
          <h2 className="mb-4 text-lg font-bold">Configuración</h2>
          {config ? (
            <RankingSettingsForm
              audience={config.ranking_audience}
              campaignId={campaign.id}
              highlightTop={config.ranking_highlight_top}
              identity={config.ranking_identity}
              visible={config.ranking_visible}
            />
          ) : null}
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold">Ajuste manual de puntos</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Para misiones presenciales validadas por el staff o correcciones. Nunca se edita un
            movimiento: se agrega uno nuevo.
          </p>
          <PointAdjustmentForm
            campaignId={campaign.id}
            participants={standings.map(({ alias, passport_code, user_id }) => ({ alias, passport_code, user_id }))}
          />
        </section>
      </div>

      <section className={card}>
        <h2 className="text-lg font-bold">Clasificación completa ({standings.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Participante</th>
                <th className="py-2 pr-3">Pasaporte</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Puntos</th>
                <th className="py-2 pr-3 text-right">Aciertos</th>
                <th className="py-2 text-right">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {standings.map((row) => (
                <tr key={row.user_id}>
                  <td className="py-2 pr-3 font-bold">{row.standing}</td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">@{row.alias}</span>
                    <span className="block text-xs text-slate-500">{row.full_name}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.passport_code}</td>
                  <td className="py-2 pr-3">{STATUS_LABELS[row.status] ?? row.status}</td>
                  <td className="py-2 pr-3 text-right font-bold">{row.points}</td>
                  <td className="py-2 pr-3 text-right">{row.correct_answers}</td>
                  <td className="py-2 text-right">{row.events_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {standings.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aún no hay participantes.</p>
          ) : null}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Últimos movimientos</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin movimientos todavía.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {events.map((event) => (
              <li className="flex flex-wrap items-start justify-between gap-3 py-3" key={event.id}>
                <div className="min-w-0">
                  <p>
                    <span className="font-semibold">@{event.alias}</span> · {event.description}
                  </p>
                  <p className="text-xs text-slate-500">
                    {POINT_KIND_LABELS[event.kind] ?? event.kind} · {dateFormat.format(new Date(event.created_at))}
                    {event.reason ? ` · Motivo: ${event.reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${event.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatPoints(event.amount)}
                  </span>
                  {event.is_reversed ? (
                    <span className="text-xs text-slate-500">Revertido</span>
                  ) : event.kind !== "correction" ? (
                    <ReverseEventForm campaignId={campaign.id} eventId={event.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
