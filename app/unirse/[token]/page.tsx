import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { inviteActions } from "@/components/campaign/invite-header";
import { LandingPage } from "@/components/landing/landing-page";
import { getSignedIn } from "@/components/site/site-header";
import { getCampaignInvite } from "@/lib/campaign/queries";
import { DEFAULT_THEME } from "@/lib/landing/schema";

export const dynamic = "force-dynamic";

// The link is shared by hand: it must never end up in search results.
export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Invitación a una campaña",
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, signedIn] = await Promise.all([getCampaignInvite(token), getSignedIn()]);

  if (!invite) {
    notFound();
  }

  return (
    <LandingPage
      actions={inviteActions(token, invite)}
      campaign={invite.campaign}
      content={invite.landing ?? { sections: [], theme: DEFAULT_THEME }}
      rulesHref={`/unirse/${token}/reglas`}
      signedIn={signedIn}
    />
  );
}
