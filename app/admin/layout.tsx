import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminScope } from "@/lib/campaign/queries";
import { getMyProfile } from "@/lib/profile/my-profile";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { role, user } = await requireAdminPage();
  const [profile, scope] = await Promise.all([getMyProfile(user.id), getAdminScope()]);
  const privateCampaigns = scope.campaigns.filter((campaign) => campaign.is_private && campaign.status !== "archived");
  const main = scope.campaigns.find((campaign) => !campaign.is_private && campaign.status === "published");
  const campaignOptions = [
    { label: main ? `${main.name} (principal)` : "Campaña principal", value: "" },
    ...privateCampaigns.map((campaign) => ({ label: `${campaign.name} (privada)`, value: campaign.slug })),
  ];

  return (
    <AdminShell
      alias={profile?.alias ?? null}
      avatarId={profile?.avatar_id ?? null}
      campaignOptions={privateCampaigns.length > 0 ? campaignOptions : []}
      campaignValue={scope.campaign?.is_private ? scope.campaign.slug : ""}
      role={role}
    >
      {children}
    </AdminShell>
  );
}
