import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { AppHeader } from "@/components/app/app-header";
import { requireAdminPage } from "@/lib/auth/guards";
import { getMyProfile } from "@/lib/profile/my-profile";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { role, user } = await requireAdminPage();
  const profile = await getMyProfile(user.id);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <AppHeader alias={profile?.alias ?? null} avatarId={profile?.avatar_id ?? null} role={role} />
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
