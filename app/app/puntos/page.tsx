import type { Metadata } from "next";

import { PixelCard, SectionTitle } from "@/components/auth/form-ui";
import { requireSessionPage } from "@/lib/auth/guards";
import { formatPoints, POINT_KIND_LABELS } from "@/lib/points/config";
import { getMyPoints } from "@/lib/points/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Mis puntos",
};

const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});

export default async function PointsPage() {
  await requireSessionPage("/app/puntos");
  const points = await getMyPoints();

  return (
    <div className="space-y-8">
      <section className="pixel-frame flex flex-wrap items-end justify-between gap-6 bg-[var(--accent)] p-6 text-[var(--accent-contrast)] sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Total acumulado</p>
          <h1 className="mt-2 font-score text-5xl leading-none sm:text-6xl">
            {new Intl.NumberFormat("es-SV").format(points.total)}
            <span className="ml-2 text-2xl">pts</span>
          </h1>
        </div>
        <p className="font-score text-2xl">{points.standing ? `Posición #${points.standing}` : "Sin posición aún"}</p>
      </section>

      <PixelCard>
        <SectionTitle description="Cada movimiento es oficial e inmutable. Las correcciones aparecen como un movimiento aparte.">
          Historial
        </SectionTitle>

        {points.events.length === 0 ? (
          <p className="border-2 border-dashed border-slate-300 p-6 text-center text-slate-600">
            Todavía no tienes puntos. Completa trivias y misiones para empezar a sumar.
          </p>
        ) : (
          <ul className="divide-y-2 divide-dashed divide-slate-200">
            {points.events.map((event) => (
              <li className="flex items-center justify-between gap-4 py-4" key={event.id}>
                <div className="min-w-0">
                  <p className="font-bold">{event.description}</p>
                  <p className="text-xs text-slate-500">
                    {POINT_KIND_LABELS[event.kind] ?? "Movimiento"} · {dateFormat.format(new Date(event.created_at))}
                  </p>
                </div>
                <p
                  className={`shrink-0 font-score text-2xl ${event.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatPoints(event.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PixelCard>
    </div>
  );
}
