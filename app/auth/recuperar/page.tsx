import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { FormSubmit } from "@/components/auth/form-submit";
import { confirmRecoveryAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Recuperar contraseña | Reto Semanal",
};

interface RecoverPageProps {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}

export default async function RecoverPage({ searchParams }: RecoverPageProps) {
  const { token_hash: tokenHash } = await searchParams;

  if (typeof tokenHash !== "string" || !tokenHash) {
    redirect("/forgot-password?error=invalid-link");
  }

  return (
    <AuthShell
      subtitle="Pulsa el botón para continuar y elegir tu contraseña nueva. El enlace es de un solo uso y vale 1 hora."
      title="Recupera tu contraseña"
    >
      <form action={confirmRecoveryAction}>
        <input name="token_hash" type="hidden" value={tokenHash} />
        <FormSubmit pendingLabel="Verificando…">Continuar</FormSubmit>
      </form>
    </AuthShell>
  );
}
