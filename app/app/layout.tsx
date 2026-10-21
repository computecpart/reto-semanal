import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { requireSessionPage } from "@/lib/auth/guards";
import { getMyRulesStatus } from "@/lib/campaign/queries";
import { getMyProfile } from "@/lib/profile/my-profile";

export default async function ParticipantLayout({ children }: { children: ReactNode }) {
  const { role, user } = await requireSessionPage("/app/perfil");
  const [profile, rulesStatus] = await Promise.all([getMyProfile(user.id), getMyRulesStatus()]);

  // A newer major rules version must be accepted before using the app.
  if (rulesStatus.required) {
    redirect("/aceptar-reglas");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <AppHeader alias={profile?.alias ?? null} avatarId={profile?.avatar_id ?? null} role={role} />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
