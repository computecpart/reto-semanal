import Link from "next/link";

import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "@/lib/campaign/status";

const STATUS_STYLES: Readonly<Record<CampaignStatus, string>> = {
  archived: "bg-slate-200 text-slate-700",
  closed: "bg-amber-100 text-amber-900",
  draft: "bg-slate-100 text-slate-700",
  finalized: "bg-violet-100 text-violet-900",
  published: "bg-emerald-100 text-emerald-900",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[status]}`}>
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}

const TABS = [
  { href: "", key: "datos", label: "Datos y estado" },
  { href: "/portada", key: "portada", label: "Portada" },
  { href: "/reglas", key: "reglas", label: "Reglas" },
] as const;

export function CampaignTabs({
  active,
  campaignId,
  name,
  status,
}: {
  active: (typeof TABS)[number]["key"];
  campaignId: string;
  name: string;
  status: CampaignStatus;
}) {
  return (
    <div className="space-y-4">
      <Link className="text-sm font-semibold text-sky-800 hover:underline" href="/admin/campana">
        <span aria-hidden="true">← </span>Campañas
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
        <CampaignStatusBadge status={status} />
      </div>
      <nav aria-label="Secciones de la campaña" className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            aria-current={tab.key === active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab.key === active ? "border-sky-700 text-sky-800" : "border-transparent text-slate-600 hover:text-slate-950"}`}
            href={`/admin/campana/${campaignId}${tab.href}`}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
