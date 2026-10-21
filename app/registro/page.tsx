import type { Metadata } from "next";
import { connection } from "next/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationForm } from "@/components/auth/registration-form";
import { getOperationalDate } from "@/lib/validation/profile";

export const metadata: Metadata = {
  title: "Registro | Reto Semanal",
};

export default async function RegistrationPage() {
  // Age rules depend on today in America/El_Salvador, so render per request.
  await connection();
  const operationalDate = getOperationalDate(new Date());

  return (
    <AuthShell
      subtitle="Completa tus datos, elige uno de los avatares oficiales y verifica tu correo para activar la cuenta."
      title="Crea tu cuenta"
    >
      <RegistrationForm operationalDate={operationalDate} />
    </AuthShell>
  );
}

