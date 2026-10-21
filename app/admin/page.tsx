import type { Metadata } from "next";
import Link from "next/link";

import { CampaignStatusBadge } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaigns, getAdminLanding, getAdminRulesVersions } from "@/lib/campaign/queries";
import { getAdminRankingConfig, getAdminRecentEvents, getAdminStandings } from "@/lib/points/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Panel | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const numberFormat = new Intl.NumberFormat("es-SV");
const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default async function AdminPage() {
  // Each admin page re-checks the role: layouts are not re-run on every
  // client navigation, so they are not a sufficient boundary on their own.
  await requireAdminPage();
  const campaigns = await getAdminCampaigns();
  const current = campaigns.find((campaign) => campaign.status === "published") ?? campaigns[0];

  if (!current) {
    return (
      <section className={card}>
        <h1 className="text-2xl font-bold">Bienvenido a la consola</h1>
        <p className="mt-2 text-sm text-slate-600">
          Crea la primera campaña para configurar portada, fechas, premio y reglas.
        </p>
        <Link
          className="mt-5 inline-flex rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href="/admin/campana"
        >
          Crear campaña
        </Link>
      </section>
    );
  }

  const [landing, rules, ranking, standings, events] = await Promise.all([
    getAdminLanding(current.id),
    getAdminRulesVersions(current.id),
    getAdminRankingConfig(current.id),
    getAdminStandings(current.id),
    getAdminRecentEvents(current.id),
  ]);
  const totalPoints = standings.reduce((sum, row) => sum + row.points, 0);
  const base = `/admin/campana/${current.id}`;
  const checklist = [
    { done: Boolean(current.starts_at && current.ends_at), href: base, label: "Fechas de inicio y cierre" },
    { done: Boolean(current.prize_title), href: base, label: "Premio definido" },
    { done: rules.length > 0, href: `${base}/reglas`, label: "Reglas publicadas" },
    { done: (landing?.publishedVersion ?? 0) > 0, href: `${base}/portada`, label: "Portada publicada" },
    { done: current.status === "published", href: base, label: "Campaña publicada" },
    { done: Boolean(ranking?.ranking_visible), href: "/admin/ranking", label: "Ranking visible" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Campaña actual</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{current.name}</h1>
            <CampaignStatusBadge status={current.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {current.starts_at && current.ends_at
              ? `${dateFormat.format(new Date(current.starts_at))} → ${dateFormat.format(new Date(current.ends_at))} (hora de El Salvador)`
              : "Fechas sin definir"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link className="rounded-lg bg-sky-700 px-4 py-2 text-white hover:bg-sky-800" href={`${base}/portada`}>
            Editar portada
          </Link>
          <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50" href={base}>
            Datos y estado
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Participantes" value={numberFormat.format(standings.length)} />
        <Stat label="Puntos otorgados" value={numberFormat.format(totalPoints)} />
        <Stat label="Versión de reglas" value={rules[0] ? `v${rules[0].version}` : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h2 className="text-lg font-bold">Preparación</h2>
          <ul className="mt-4 space-y-1 text-sm">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50" href={item.href}>
                  <span
                    aria-hidden="true"
                    className={`grid size-5 place-items-center rounded-full text-xs font-bold ${item.done ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                  >
                    {item.done ? "✓" : "!"}
                  </span>
                  <span className={item.done ? "text-slate-700" : "font-semibold"}>{item.label}</span>
                  <span className="sr-only">{item.done ? "(listo)" : "(pendiente)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Actividad reciente</h2>
            <Link className="text-sm font-semibold text-sky-800 hover:underline" href="/admin/ranking">
              Ver todo
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aún no hay movimientos de puntos.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 text-sm">
              {events.slice(0, 6).map((event) => (
                <li className="flex justify-between gap-3 py-2" key={event.id}>
                  <span className="truncate">
                    <span className="font-semibold">@{event.alias}</span> · {event.description}
                  </span>
                  <span className={`shrink-0 font-bold ${event.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {event.amount > 0 ? "+" : ""}
                    {event.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
