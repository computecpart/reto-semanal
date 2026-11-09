import { SiteHeaderView, DEFAULT_SITE_ACTIONS, type SiteActions } from "@/components/site/site-header";
import { CHOOSER_PATH } from "@/lib/campaign/choices";
import type { CampaignInvite } from "@/lib/campaign/queries";
import { landingAssetUrl } from "@/lib/landing/assets";
import { DEFAULT_THEME } from "@/lib/landing/schema";
import { themeStyle } from "@/lib/landing/theme";

/** Where each button of an invitation leads. Nothing here points at the main campaign. */
export function inviteActions(token: string, invite: CampaignInvite): SiteActions {
  const accept = `/unirse/${token}/aceptar`;

  return {
    ...DEFAULT_SITE_ACTIONS,
    home: `/unirse/${token}`,
    login: `/login?next=${encodeURIComponent(accept)}`,
    // Members of more than one campaign choose where to go; the rest go straight in.
    member: invite.isMember ? CHOOSER_PATH : accept,
    memberLabel: invite.isMember ? "Entrar a la campaña" : "Unirme a la campaña",
    register: `/registro?invitacion=${token}`,
  };
}

export function inviteBranding(invite: CampaignInvite) {
  return { name: invite.campaign.name, theme: invite.landing?.theme ?? DEFAULT_THEME };
}

export function InviteHeader({
  invite,
  signedIn,
  token,
}: {
  invite: CampaignInvite;
  signedIn: boolean;
  token: string;
}) {
  const { name, theme } = inviteBranding(invite);
  const logoUrl = landingAssetUrl(theme.logo?.path);

  return (
    <SiteHeaderView
      actions={inviteActions(token, invite)}
      campaignName={name}
      dark={theme.surface === "oscuro"}
      links={[{ href: `/unirse/${token}/reglas`, label: "Reglas" }]}
      logo={logoUrl ? { alt: theme.logo?.alt || name, url: logoUrl } : null}
      signedIn={signedIn}
      themeVars={themeStyle(theme)}
    />
  );
}
