import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nueva contraseña | Reto Semanal",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims.sub) {
    redirect("/forgot-password?error=invalid-link");
  }

  return (
    <AuthShell
      subtitle="Elige una contraseña nueva. No la reutilices en otros servicios."
      title="Crea una contraseña nueva"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

