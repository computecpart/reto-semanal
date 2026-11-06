import Link from "next/link";

import { joinPrimaryCampaignAction } from "@/lib/campaign/actions";

const pill =
  "inline-flex min-h-9 items-center whitespace-nowrap border-2 border-[var(--color-ink)] px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

/** Shown only to people with access to more than one campaign. */
export function CampaignSwitcher({
  campaigns,
  joinableMain,
}: {
  campaigns: readonly { active: boolean; href: string; name: string }[];
  /** Name of the main campaign for invited accounts that are not part of it yet. */
  joinableMain: string | null;
}) {
  if (campaigns.length < 2 && !joinableMain) {
    return null;
  }

  return (
    <nav aria-label="Mis campañas" className="border-b-2 border-[var(--color-ink)] bg-[var(--accent-soft)]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600">Mis campañas</span>
        {campaigns.map((campaign) => (
          <Link
            aria-current={campaign.active ? "page" : undefined}
            className={`${pill} ${campaign.active ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "bg-white text-[var(--color-ink)]"}`}
            href={campaign.href}
            key={campaign.href}
          >
            {campaign.name}
          </Link>
        ))}
        {joinableMain ? (
          <form action={joinPrimaryCampaignAction}>
            <button className={`${pill} bg-white text-[var(--color-ink)]`} type="submit">
              Unirme también a {joinableMain}
            </button>
          </form>
        ) : null}
      </div>
    </nav>
  );
}
