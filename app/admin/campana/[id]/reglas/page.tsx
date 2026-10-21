import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignTabs } from "@/components/admin/admin-nav";
import { RulesPublishForm } from "@/components/admin/campaign-forms";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminCampaign, getAdminRulesVersions } from "@/lib/campaign/queries";
import { DEFAULT_RULES_MARKDOWN } from "@/lib/landing/defaults";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Reglas | Administración",
};

const cardClassName = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

export default async function CampaignRulesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const campaign = await getAdminCampaign(id);

  if (!campaign) {
    notFound();
  }

  const versions = await getAdminRulesVersions(campaign.id);
  const latest = versions[0];

  return (
    <div className="space-y-6">
      <CampaignTabs active="reglas" campaignId={campaign.id} name={campaign.name} status={campaign.status} />

      <section className={cardClassName}>
        <h2 className="text-lg font-bold">Publicar nueva versión</h2>
        <p className="mb-5 mt-1 text-sm text-slate-600">
          Las versiones publicadas son inmutables. Cada participante queda registrado con la versión
          que aceptó.
        </p>
        <RulesPublishForm
          campaignId={campaign.id}
          initialContent={latest?.content_md ?? DEFAULT_RULES_MARKDOWN}
          isFirstVersion={!latest}
        />
      </section>

      {latest ? (
        <section className={cardClassName}>
          <h2 className="text-lg font-bold">Versión vigente ({latest.version})</h2>
          <SafeMarkdown className="mt-4 text-slate-800">{latest.content_md}</SafeMarkdown>
        </section>
      ) : null}

      {versions.length > 0 ? (
        <section className={cardClassName}>
          <h2 className="text-lg font-bold">Historial</h2>
          <ul className="mt-4 divide-y divide-slate-200 text-sm">
            {versions.map((version) => (
              <li className="py-3" key={version.version}>
                <strong>Versión {version.version}</strong>
                {version.is_major ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Importante</span> : null}
                <span className="ml-2 text-slate-500">
                  {new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE }).format(new Date(version.published_at))}
                </span>
                {version.change_summary ? <p className="mt-1 text-slate-600">{version.change_summary}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
