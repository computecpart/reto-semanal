"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { selectAdminCampaignAction } from "@/lib/campaign/actions";

/** Picks the campaign every console section works on. */
export function CampaignScopeSelect({
  campaigns,
  value,
}: {
  campaigns: readonly { label: string; value: string }[];
  value: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="mx-3 mb-3 block rounded-lg bg-slate-900 p-2 text-xs font-semibold text-slate-400">
      Trabajando en
      <select
        className="mt-1 min-h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm font-bold text-white disabled:opacity-60"
        disabled={pending}
        onChange={(event) => {
          const slug = event.target.value;
          // The proxy reads the cookie per request, so re-render with a fresh one.
          startTransition(async () => {
            await selectAdminCampaignAction(slug);
            router.refresh();
          });
        }}
        value={value}
      >
        {campaigns.map((campaign) => (
          <option key={campaign.value} value={campaign.value}>
            {campaign.label}
          </option>
        ))}
      </select>
    </label>
  );
}
