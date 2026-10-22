import type { Metadata } from "next";
import Link from "next/link";

import { ActionForm } from "@/components/admin/action-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { setParticipantStatusAction } from "@/lib/moderation/actions";
import { listParticipants, PAGE_SIZE } from "@/lib/moderation/queries";
import { formatSalvadorPhone, EL_SALVADOR_DEPARTMENTS } from "@/lib/validation/profile";

export const metadata: Metadata = {
  title: "Participantes | Administración",
};

const STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "Activo",
  archived: "Archivado",
  disqualified: "Descalificado",
  suspended: "Suspendido",
};

const STATUS_STYLES: Readonly<Record<string, string>> = {
  active: "bg-emerald-100 text-emerald-900",
  archived: "bg-slate-200 text-slate-700",
  disqualified: "bg-red-100 text-red-900",
  suspended: "bg-amber-100 text-amber-900",
};

const input = "min-h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm";

type Params = Record<string, string | string[] | undefined>;

function param(params: Params, name: string): string {
  const value = params[name];
  return typeof value === "string" ? value.slice(0, 100) : "";
}

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { role } = await requireAdminPage();
  const params = await searchParams;
  const filters = {
    age: param(params, "edad"),
    department: param(params, "departamento"),
    page: Math.max(1, Number(param(params, "pagina")) || 1),
    query: param(params, "q"),
    role: param(params, "rol"),
    status: param(params, "estado"),
  };
  const rows = await listParticipants(filters);
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (page: number) => {
    const next = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => typeof v === "string")) as Record<string, string>, pagina: String(page) });
    return `/admin/participantes?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Participantes</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} resultados. Toda suspensión o descalificación exige motivo y queda en la auditoría. Nunca se borran cuentas con historial.
          </p>
        </div>
        {role === "superadmin" ? (
          <a className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50" href="/admin/participantes/exportar">
            Exportar CSV
          </a>
        ) : null}
      </header>

      <form className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:flex-wrap" method="get">
        <input aria-label="Buscar" className={`${input} col-span-2 min-w-0 sm:min-w-56 sm:flex-1`} defaultValue={filters.query} name="q" placeholder="Alias, nombre, correo o pasaporte" />
        <select aria-label="Estado" className={input} defaultValue={filters.status} name="estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Departamento" className={input} defaultValue={filters.department} name="departamento">
          <option value="">Todos los departamentos</option>
          {EL_SALVADOR_DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <select aria-label="Edad" className={input} defaultValue={filters.age} name="edad">
          <option value="">Todas las edades</option>
          <option value="adult">Mayores de edad</option>
          <option value="minor">Menores de edad</option>
        </select>
        <select aria-label="Rol" className={input} defaultValue={filters.role} name="rol">
          <option value="">Todos los roles</option>
          <option value="participant">Participante</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <button className="col-span-2 min-h-10 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 sm:col-span-1" type="submit">
          Filtrar
        </button>
      </form>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={row.user_id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  @{row.alias} · {row.first_name} {row.last_name}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[row.status] ?? ""}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                  {row.role !== "participant" ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900">{row.role}</span> : null}
                </p>
                <p className="text-xs text-slate-500">
                  {row.email} · {formatSalvadorPhone(row.phone) || "sin teléfono"} · {row.department ?? "—"} · {row.age ?? "—"} años (
                  {row.is_adult ? "mayor" : "menor"}) · <span className="font-mono">{row.passport_code}</span> ·{" "}
                  {new Date(row.registered_at).toLocaleDateString("es-SV", { timeZone: "America/El_Salvador" })}
                </p>
              </div>
              <p className="font-bold">{row.points} pts</p>
            </div>
            <details className="mt-2">
              <summary className="inline-flex min-h-9 cursor-pointer items-center text-xs font-semibold text-sky-800">Cambiar estado</summary>
              <div className="mt-2">
                <ActionForm action={setParticipantStatusAction} confirm="¿Aplicar este cambio de estado?" submitLabel="Aplicar">
                  <input name="userId" type="hidden" value={row.user_id} />
                  <select aria-label="Nuevo estado" className={input} defaultValue="suspended" name="status">
                    {Object.entries(STATUS_LABELS)
                      .filter(([value]) => value !== row.status)
                      .map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                  </select>
                  <input aria-label="Motivo" className={`${input} min-w-64 flex-1`} maxLength={500} name="reason" placeholder="Motivo (mín. 10 caracteres; no se muestra al participante)" />
                </ActionForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="text-sm text-slate-500">Sin resultados.</p> : null}

      <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
        {filters.page > 1 ? <Link className="font-semibold text-sky-800" href={pageLink(filters.page - 1)}>← Anterior</Link> : <span />}
        <span className="text-slate-500">
          Página {filters.page} de {pages}
        </span>
        {filters.page < pages ? <Link className="font-semibold text-sky-800" href={pageLink(filters.page + 1)}>Siguiente →</Link> : <span />}
      </nav>
    </div>
  );
}
