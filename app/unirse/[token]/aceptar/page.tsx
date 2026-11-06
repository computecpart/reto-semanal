import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteHeader, inviteBranding } from "@/components/campaign/invite-header";
import { JoinCampaignForm } from "@/components/campaign/join-campaign-form";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { requireSessionPage } from "@/lib/auth/guards";
import { getCampaignInvite } from "@/lib/campaign/queries";
import { campaignBase } from "@/lib/campaign/scope";
import { isAdministrativeRole } from "@/lib/permissions/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Unirme a la campaña",
};

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { role } = await requireSessionPage(`/unirse/${token}/aceptar`);
  const invite = await getCampaignInvite(token);

  if (!invite) {
    notFound();
  }

  if (invite.isMember) {
    redirect(campaignBase(invite.campaign.slug));
  }

  return (
    <AuthShell
      eyebrow={invite.campaign.name}
      invite={{
        branding: inviteBranding(invite),
        header: <InviteHeader invite={invite} signedIn token={token} />,
        rulesHref: `/unirse/${token}/reglas`,
      }}
      subtitle="Usarás la misma cuenta. Tus puntos de esta campaña son independientes de cualquier otra."
      title={`Unirme a ${invite.campaign.name}`}
      wide
    >
      {isAdministrativeRole(role) ? (
        <p className="text-slate-600">
          Las cuentas del equipo organizador no participan. Puedes ver la campaña desde la consola de administración.
        </p>
      ) : (
        <div className="space-y-6">
          {invite.rulesMd ? (
            <div className="max-h-[50vh] overflow-y-auto border-2 border-slate-200 p-4 sm:p-5">
              <SafeMarkdown>{invite.rulesMd}</SafeMarkdown>
            </div>
          ) : null}
          <JoinCampaignForm campaignName={invite.campaign.name} token={token} />
        </div>
      )}
    </AuthShell>
  );
}
