import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verificar correo | Reto Semanal",
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Revisa tu bandeja de entrada e ingresa el código de un solo uso (o abre el enlace) para confirmar la dirección."
      title="Verifica tu correo"
    >
      <VerifyEmailForm linkError={params.error === "enlace"} />
    </AuthShell>
  );
}

