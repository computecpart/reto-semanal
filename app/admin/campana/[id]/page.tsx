import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignTabs } from "@/components/admin/admin-nav";
import { CampaignDetailsForm, CampaignStatusForm } from "@/components/admin/campaign-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaign } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  title: "Campaña | Administración",
};

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const campaign = await getAdminCampaign(id);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CampaignTabs active="datos" campaignId={campaign.id} name={campaign.name} status={campaign.status} />

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-bold">Datos de la campaña</h2>
        <CampaignDetailsForm campaign={campaign} />
      </section>

      <section className={cardClassName}>
        <h2 className="mb-5 text-lg font-bold">Estado</h2>
        <CampaignStatusForm campaignId={campaign.id} status={campaign.status} />
      </section>
    </div>
  );
}
