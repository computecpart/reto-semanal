import type { Metadata } from "next";
import Link from "next/link";

import { MissionForm } from "@/components/admin/mission-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminMissions } from "@/lib/missions/queries";
import { formatCode } from "@/lib/missions/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Misiones | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "short", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE });

export default async function AdminMissionsPage() {
  await requireAdminPage();
  const missions = await getAdminMissions();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Misiones y códigos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cada misión tiene un código y un QR equivalentes: un participante solo puede canjearla una vez por cualquiera
          de los dos. Muestra el código o el QR solo a quien completó la actividad.
        </p>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Misión</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3 text-right">Puntos</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3 text-right">Canjes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {missions.map((mission) => (
              <tr key={mission.id}>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-sky-800 hover:underline" href={`/admin/misiones/${mission.id}`}>
                    {mission.name}
                  </Link>
                  {!mission.enabled ? <span className="ml-2 text-xs text-slate-500">pausada</span> : null}
                </td>
                <td className="px-4 py-3 font-mono">{mission.code ? formatCode(mission.code) : "—"}</td>
                <td className="px-4 py-3 text-right font-bold">{mission.points}</td>
                <td className="px-4 py-3 text-xs">
                  {dateFormat.format(new Date(mission.starts_at))} → {dateFormat.format(new Date(mission.expires_at))}
                </td>
                <td className="px-4 py-3 text-right">{mission.redemption_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {missions.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Aún no hay misiones.</p> : null}
      </section>

      <section className={card}>
        <h2 className="mb-4 text-lg font-bold">Nueva misión</h2>
        <MissionForm mission={null} />
      </section>
    </div>
  );
}
