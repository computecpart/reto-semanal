import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaign, getAdminLanding } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Vista previa | Administración",
};

// Renders the saved draft with the exact public renderer.
export default async function LandingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
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
    <div>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950">
        <span>Vista previa del borrador. Los visitantes aún no la ven.</span>
        <Link className="underline" href={`/admin/campana/${campaign.id}/portada`}>
          Volver al editor
        </Link>
      </div>
      <LandingPage campaign={campaign} content={landing.draft} signedIn={false} />
    </div>
  );
}
