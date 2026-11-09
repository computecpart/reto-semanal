import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { InviteHeader, inviteBranding } from "@/components/campaign/invite-header";
import { getCampaignInvite } from "@/lib/campaign/queries";

export const metadata: Metadata = {
  title: "Verificar correo | Reto Semanal",
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ error?: string | string[]; invitacion?: string | string[] }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = typeof params.invitacion === "string" ? params.invitacion : null;
  const invite = token ? await getCampaignInvite(token) : null;

  return (
    <AuthShell
      eyebrow={invite?.campaign.name}
      invite={
        invite && token
          ? {
              branding: inviteBranding(invite),
              header: <InviteHeader invite={invite} signedIn={false} token={token} />,
              rulesHref: `/unirse/${token}/reglas`,
            }
          : undefined
      }
      subtitle="Revisa tu bandeja de entrada e ingresa el código de un solo uso (o abre el enlace) para confirmar la dirección."
      title="Verifica tu correo"
    >
      <VerifyEmailForm
        linkError={params.error === "enlace"}
        loginHref={
          invite && token ? `/login?next=${encodeURIComponent(`/unirse/${token}/aceptar`)}` : "/login"
        }
      />
    </AuthShell>
  );
}

