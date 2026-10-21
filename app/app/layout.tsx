import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { LegalLinks } from "@/components/legal/legal-page";
import { requireSessionPage } from "@/lib/auth/guards";
import { getMyRulesStatus, getSiteBranding } from "@/lib/campaign/queries";
import { themeStyle } from "@/lib/landing/theme";
import { getMyProfile } from "@/lib/profile/my-profile";

export default async function ParticipantLayout({ children }: { children: ReactNode }) {
  const { role, user } = await requireSessionPage("/app/perfil");
  const [profile, rulesStatus, branding] = await Promise.all([
    getMyProfile(user.id),
    getMyRulesStatus(),
    getSiteBranding(),
  ]);

  // A newer major rules version must be accepted before using the app.
  if (rulesStatus.required) {
    redirect("/aceptar-reglas");
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]"
      style={themeStyle(branding.theme)}
    >
      <AppHeader
        alias={profile?.alias ?? null}
        avatarId={profile?.avatar_id ?? null}
        campaignName={branding.name}
        role={role}
      />
      <main className="pixel-grid flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
      </main>
      <footer className="border-t-4 border-[var(--color-ink)] px-4 py-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
