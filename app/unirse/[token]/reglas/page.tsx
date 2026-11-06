import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteHeader, inviteActions, inviteBranding } from "@/components/campaign/invite-header";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { getSignedIn } from "@/components/site/site-header";
import { getCampaignInvite } from "@/lib/campaign/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Reglas de la campaña",
};

export default async function InvitationRulesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, signedIn] = await Promise.all([getCampaignInvite(token), getSignedIn()]);

  if (!invite) {
    notFound();
  }

  const actions = inviteActions(token, invite);

  return (
    <AuthShell
      eyebrow={invite.campaign.name}
      invite={{
        branding: inviteBranding(invite),
        header: <InviteHeader invite={invite} signedIn={signedIn} token={token} />,
        rulesHref: `/unirse/${token}/reglas`,
      }}
      subtitle="Estas son las reglas oficiales de la campaña."
      title="Reglas de participación"
      wide
    >
      {invite.rulesMd ? <SafeMarkdown>{invite.rulesMd}</SafeMarkdown> : <p className="text-slate-600">Las reglas se publicarán pronto.</p>}
      <p className="mt-6">
        <Link className="font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline" href={actions.home}>
          Volver a la invitación
        </Link>
      </p>
    </AuthShell>
  );
}
