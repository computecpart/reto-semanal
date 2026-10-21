import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/guards";
import { getMyProfile } from "@/lib/profile/my-profile";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { role, user } = await requireAdminPage();
  const profile = await getMyProfile(user.id);

  return (
    <AdminShell alias={profile?.alias ?? null} avatarId={profile?.avatar_id ?? null} role={role}>
      {children}
    </AdminShell>
  );
}
