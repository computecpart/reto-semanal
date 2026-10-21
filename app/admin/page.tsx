import type { Metadata } from "next";
import Link from "next/link";

import { CampaignStatusBadge } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaigns } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  title: "Administración | Reto Semanal",
};

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

export default async function AdminPage() {
  // Each admin page re-checks the role: layouts are not re-run on every
  // client navigation, so they are not a sufficient boundary on their own.
  const { role } = await requireAdminPage();
  const campaigns = await getAdminCampaigns();
  const current = campaigns.find((campaign) => campaign.status === "published") ?? campaigns[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
          {role === "superadmin" ? "Superadministrador" : "Administrador"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Panel</h1>
      </header>

      {current ? (
        <section className={cardClassName}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold">{current.name}</h2>
            <CampaignStatusBadge status={current.status} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="rounded-lg bg-sky-700 px-4 py-2 text-white hover:bg-sky-800" href={`/admin/campana/${current.id}/portada`}>
              Editar portada
            </Link>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50" href={`/admin/campana/${current.id}`}>
              Datos y estado
            </Link>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50" href={`/admin/campana/${current.id}/reglas`}>
              Reglas
            </Link>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50" href="/" target="_blank">
              Ver sitio público
            </Link>
          </div>
        </section>
      ) : (
        <section className={cardClassName}>
          <h2 className="text-xl font-bold">Aún no hay campañas</h2>
          <p className="mt-2 text-sm text-slate-600">
            Crea la primera campaña para configurar la portada, las fechas, el premio y las reglas.
          </p>
          <Link className="mt-5 inline-flex rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800" href="/admin/campana">
            Crear campaña
          </Link>
        </section>
      )}

      <section className={cardClassName}>
        <h2 className="text-lg font-bold">Próximos módulos</h2>
        <p className="mt-2 text-sm text-slate-600">
          Puntos y ranking, cuestionarios, recompensas QR y moderación se habilitarán en las
          siguientes fases.
        </p>
      </section>
    </div>
  );
}
