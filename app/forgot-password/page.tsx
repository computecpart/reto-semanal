import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña | Reto Semanal",
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{ error?: string | string[] }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      subtitle="Te enviaremos un enlace seguro si el correo corresponde a una cuenta."
      title="Recupera tu contraseña"
    >
      <ForgotPasswordForm callbackError={params.error === "invalid-link"} />
    </AuthShell>
  );
}

