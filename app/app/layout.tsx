import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { LegalLinks } from "@/components/legal/legal-page";
import { requireSessionPage } from "@/lib/auth/guards";
import { campaignChoices } from "@/lib/campaign/choices";
import { getMyCampaigns, getMyRulesStatus, getSiteBranding } from "@/lib/campaign/queries";
import { campaignBase } from "@/lib/campaign/scope";
import { getCampaignSlug } from "@/lib/campaign/scope-server";
import { themeStyle } from "@/lib/landing/theme";
import { getMyParticipantStatus } from "@/lib/points/queries";
import { getMyProfile } from "@/lib/profile/my-profile";

const STATUS_BANNERS: Readonly<Record<string, string>> = {
  archived: "Tu cuenta está archivada. Contacta al equipo organizador si crees que es un error.",
  disqualified: "Tu cuenta fue descalificada de la competencia. Contacta al equipo organizador para más información.",
  suspended: "Tu cuenta está suspendida temporalmente: por ahora no puedes sumar puntos ni iniciar actividades.",
};

export default async function ParticipantLayout({ children }: { children: ReactNode }) {
  const slug = await getCampaignSlug();
  const base = campaignBase(slug);
  const { role, user } = await requireSessionPage(base);
  const [profile, rulesStatus, branding, status, mine] = await Promise.all([
    getMyProfile(user.id),
    getMyRulesStatus(),
    getSiteBranding(),
    getMyParticipantStatus(),
    getMyCampaigns(),
  ]);
  const banner = status ? STATUS_BANNERS[status] : undefined;
  const firstCampaign = mine.campaigns[0];

  // A private campaign does not exist for anyone outside it.
  if (slug && !mine.campaigns.some((campaign) => campaign.slug === slug)) {
    notFound();
  }

  // Accounts created from an invitation have no place in the main campaign.
  if (!slug && mine.privateOnly && firstCampaign) {
    redirect(campaignBase(firstCampaign.slug));
  }

  // A newer major rules version must be accepted before using the app.
  if (rulesStatus.required) {
    redirect(slug ? `${base}/aceptar-reglas` : "/aceptar-reglas");
  }

  // Each campaign keeps its own panel and colors; switching goes through the chooser.
  const canSwitch = campaignChoices(mine).mustChoose;

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]"
      style={themeStyle(branding.theme)}
    >
      <AppHeader
        alias={profile?.alias ?? null}
        avatarId={profile?.avatar_id ?? null}
        base={base}
        campaignName={branding.name}
        canSwitch={canSwitch}
        role={role}
      />
      {banner ? (
        <p className="border-b-4 border-[var(--color-ink)] bg-amber-200 px-4 py-3 text-center text-sm font-bold" role="status">
          {banner}
        </p>
      ) : null}
      <main className="pixel-grid flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12">{children}</div>
      </main>
      <footer className="border-t-4 border-[var(--color-ink)] px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-6">
        <LegalLinks rulesHref={slug ? `${base}/reglas` : undefined} />
      </footer>
    </div>
  );
}
