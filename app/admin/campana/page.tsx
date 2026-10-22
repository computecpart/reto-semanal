import type { Metadata } from "next";
import Link from "next/link";

import { CampaignStatusBadge } from "@/components/admin/admin-nav";
import { CreateCampaignForm } from "@/components/admin/campaign-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaigns } from "@/lib/campaign/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Campañas | Administración",
};

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeZone: OPERATIONAL_TIME_ZONE }).format(new Date(value))
    : "Sin definir";
}

export default async function CampaignsPage() {
  await requireAdminPage();
  const campaigns = await getAdminCampaigns();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Campañas</h1>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {campaigns.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">Todavía no hay campañas.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link className="flex flex-wrap items-center justify-between gap-3 p-5 hover:bg-slate-50" href={`/admin/campana/${campaign.id}`}>
                  <span>
                    <span className="block font-semibold">{campaign.name}</span>
                    <span className="text-sm text-slate-500">
                      {formatDate(campaign.starts_at)} — {formatDate(campaign.ends_at)}
                    </span>
                  </span>
                  <CampaignStatusBadge status={campaign.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-bold">Nueva campaña</h2>
        <CreateCampaignForm />
      </section>
    </div>
  );
}
