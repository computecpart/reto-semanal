import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignTabs } from "@/components/admin/admin-nav";
import { LandingEditor } from "@/components/admin/landing-editor";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaign, getAdminLanding } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  title: "Portada | Administración",
};

export default async function LandingEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const campaign = await getAdminCampaign(id);

  if (!campaign) {
    notFound();
  }

  const landing = await getAdminLanding(campaign.id);

  if (!landing) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <CampaignTabs active="portada" campaignId={campaign.id} name={campaign.name} status={campaign.status} />
      <LandingEditor
        campaignId={campaign.id}
        initialContent={landing.draft}
        publishedVersion={landing.publishedVersion}
        versions={landing.versions}
      />
    </div>
  );
}
