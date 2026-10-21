import type { Metadata } from "next";
import Link from "next/link";

import { requireAdminPage } from "@/lib/auth/guards";
import { salvadorLocalToIso } from "@/lib/campaign/schemas";
import { listAudit } from "@/lib/moderation/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Auditoría | Administración",
};

const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "short", timeStyle: "medium", timeZone: OPERATIONAL_TIME_ZONE });
const ACTION_GROUPS = [
  ["", "Todas las acciones"],
  ["points.", "Puntos"],
  ["participant.", "Estados de participantes"],
  ["role.", "Roles"],
  ["quiz.", "Cuestionarios"],
  ["review.", "Revisiones"],
  ["reward.", "Misiones"],
  ["campaign.", "Campaña"],
  ["landing.", "Portada"],
  ["rules.", "Reglas"],
  ["ranking.", "Ranking"],
  ["alias_term.", "Alias"],
  ["raffle.", "Rifa"],
  ["participants.", "Exportaciones"],
] as const;

type Params = Record<string, string | string[] | undefined>;

function param(params: Params, name: string): string {
  const value = params[name];
  return typeof value === "string" ? value.slice(0, 40) : "";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPage();
  const params = await searchParams;
  const action = param(params, "accion");
  const from = param(params, "desde");
  const to = param(params, "hasta");
  const page = Math.max(1, Number(param(params, "pagina")) || 1);
  const entries = await listAudit({
    action: ACTION_GROUPS.some(([value]) => value === action) ? action : "",
    entity: "",
    from: from ? salvadorLocalToIso(`${from}T00:00`) : null,
    page,
    to: to ? salvadorLocalToIso(`${to}T23:59`) : null,
  });
  const query = (next: number) => `/admin/auditoria?${new URLSearchParams({ accion: action, desde: from, hasta: to, pagina: String(next) })}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Auditoría</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registro de solo lectura. Ni la interfaz ni la base de datos permiten editarlo o borrarlo.
        </p>
      </header>

      <form className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" method="get">
        <select aria-label="Acción" className={input} defaultValue={action} name="accion">
          {ACTION_GROUPS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm">
          Desde <input className={input} defaultValue={from} name="desde" type="date" />
        </label>
        <label className="flex items-center gap-1 text-sm">
          Hasta <input className={input} defaultValue={to} name="hasta" type="date" />
        </label>
        <button className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white" type="submit">
          Filtrar
        </button>
      </form>

      <ul className="space-y-2">
        {entries.map((entry, index) => (
          <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm" key={`${entry.occurred_at}-${index}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <span className="font-mono font-semibold">{entry.action}</span> · {entry.entity_type}
                {entry.entity_id ? <span className="text-slate-500"> {entry.entity_id.slice(0, 18)}</span> : null}
              </p>
              <p className="text-xs text-slate-500">
                {dateFormat.format(new Date(entry.occurred_at))} · {entry.actor_alias ? `@${entry.actor_alias}` : (entry.actor_role ?? "sistema")}
              </p>
            </div>
            {entry.reason ? <p className="mt-1 text-slate-700">Motivo: {entry.reason}</p> : null}
            {entry.before || entry.after ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold text-sky-800">Ver antes / después</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs">{JSON.stringify(entry.before, null, 2)}</pre>
                  <pre className="overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs">{JSON.stringify(entry.after, null, 2)}</pre>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {entries.length === 0 ? <p className="text-sm text-slate-500">Sin registros para este filtro.</p> : null}

      <nav aria-label="Paginación" className="flex justify-between text-sm">
        {page > 1 ? <Link className="font-semibold text-sky-800" href={query(page - 1)}>← Más recientes</Link> : <span />}
        {entries.length === 50 ? <Link className="font-semibold text-sky-800" href={query(page + 1)}>Más antiguos →</Link> : <span />}
      </nav>
    </div>
  );
}
