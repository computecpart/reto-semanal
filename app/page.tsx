import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { getPublicLanding, type PublicCampaign } from "@/lib/campaign/queries";
import { DEFAULT_THEME, type LandingContent } from "@/lib/landing/schema";
import { getRanking } from "@/lib/points/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicLanding().catch(() => null);
  const hero = data?.landing?.sections.find((section) => section.type === "hero");

  return {
    description: hero?.type === "hero" && hero.subtitle ? hero.subtitle : "Campaña de retos semanales.",
    title: data?.campaign.name ?? "Reto Semanal",
  };
}

const COMING_SOON_CAMPAIGN: PublicCampaign = {
  ends_at: null,
  name: "Reto Semanal",
  prize_description: null,
  prize_title: null,
  slug: "reto-semanal",
  starts_at: null,
  status: "draft",
};

const COMING_SOON_CONTENT: LandingContent = {
  sections: [
    {
      eyebrow: "Muy pronto",
      headline: "Se viene un nuevo reto",
      id: "00000000-0000-4000-8000-000000000001",
      image: null,
      layout: "centered",
      primaryCtaLabel: "Crear cuenta",
      secondaryCtaLabel: "Iniciar sesión",
      subtitle: "Regístrate desde ya para no perderte el inicio de la campaña.",
      type: "hero",
      visible: true,
    },
  ],
  theme: DEFAULT_THEME,
};

export default async function HomePage() {
  const supabase = await createClient();
  const [data, claims] = await Promise.all([getPublicLanding(), supabase.auth.getClaims()]);
  const signedIn = Boolean(claims.data?.claims.sub);

  if (!data?.landing) {
    return (
      <LandingPage
        campaign={data?.campaign ?? COMING_SOON_CAMPAIGN}
        content={COMING_SOON_CONTENT}
        signedIn={signedIn}
      />
    );
  }

  const needsRanking = data.landing.sections.some((section) => section.type === "ranking_preview" && section.visible);
  const ranking = needsRanking ? await getRanking(10).catch(() => []) : [];

  return <LandingPage campaign={data.campaign} content={data.landing} ranking={ranking} signedIn={signedIn} />;
}
