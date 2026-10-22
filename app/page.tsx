import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";
import { getPublicLanding, type PublicCampaign } from "@/lib/campaign/queries";
import { landingAssetUrl } from "@/lib/landing/assets";
import { DEFAULT_THEME, type LandingContent } from "@/lib/landing/schema";
import { getRanking } from "@/lib/points/queries";
import { getPublicQuizzes } from "@/lib/quiz/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicLanding().catch(() => null);
  const hero = data?.landing?.sections.find((section) => section.type === "hero");

  const description = hero?.type === "hero" && hero.subtitle ? hero.subtitle : "Campaña de retos semanales.";
  const title = data?.campaign.name ?? "Reto Semanal";
  const image = hero?.type === "hero" ? landingAssetUrl(hero.image?.path) : null;

  // Rich previews when the link is shared on WhatsApp or social networks.
  return {
    description,
    openGraph: { description, images: image ? [{ alt: hero?.type === "hero" ? hero.image?.alt : undefined, url: image }] : undefined, locale: "es_SV", title, type: "website" },
    title,
    twitter: { card: image ? "summary_large_image" : "summary", description, title },
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
      highlights: [],
      id: "00000000-0000-4000-8000-000000000001",
      image: null,
      layout: "centered",
      primaryCtaLabel: "Crear cuenta",
      secondaryCtaLabel: "Iniciar sesión",
      countdownAt: null,
      countdownLabel: "",
      showCountdown: false,
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
  const needsQuizzes = data.landing.sections.some((section) => section.type === "upcoming_activities" && section.visible);
  const [ranking, quizzes] = await Promise.all([
    needsRanking ? getRanking(10).catch(() => []) : [],
    needsQuizzes ? getPublicQuizzes().catch(() => []) : [],
  ]);

  return (
    <LandingPage campaign={data.campaign} content={data.landing} quizzes={quizzes} ranking={ranking} signedIn={signedIn} />
  );
}
