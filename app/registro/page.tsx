import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationForm } from "@/components/auth/registration-form";
import { InviteHeader, inviteActions, inviteBranding } from "@/components/campaign/invite-header";
import { getCampaignInvite } from "@/lib/campaign/queries";
import { getOperationalDate } from "@/lib/validation/profile";

export const metadata: Metadata = {
  title: "Registro | Reto Semanal",
};

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ invitacion?: string | string[] }>;
}) {
  // Age rules depend on today in America/El_Salvador, so render per request.
  await connection();
  const operationalDate = getOperationalDate(new Date());
  const { invitacion: token } = await searchParams;

  if (typeof token === "string") {
    const invite = await getCampaignInvite(token);

    // A dead link must not silently enrol the person in the main campaign.
    if (!invite) {
      notFound();
    }

    const rulesHref = `/unirse/${token}/reglas`;

    return (
      <AuthShell
        eyebrow={invite.campaign.name}
        invite={{
          branding: inviteBranding(invite),
          header: <InviteHeader invite={invite} signedIn={false} token={token} />,
          rulesHref,
        }}
        subtitle={`Completa tus datos para unirte a ${invite.campaign.name}. Si ya tienes cuenta, inicia sesión y no te registres de nuevo.`}
        title="Crea tu cuenta"
      >
        <RegistrationForm
          invite={{ loginHref: inviteActions(token, invite).login, rulesHref, token }}
          operationalDate={operationalDate}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      subtitle="Completa tus datos, elige uno de los avatares oficiales y verifica tu correo para activar la cuenta."
      title="Crea tu cuenta"
    >
      <RegistrationForm operationalDate={operationalDate} />
    </AuthShell>
  );
}

