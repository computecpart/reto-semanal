import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getSafePostLoginPath } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Iniciar sesión | Reto Semanal",
};

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
    password?: string | string[];
    sesion?: string | string[];
    verified?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafePostLoginPath(params.next);
  const initialNotice =
    params.password === "updated"
      ? "Tu contraseña fue actualizada. Ya puedes iniciar sesión."
      : params.verified === "1"
        ? "Tu correo fue verificado. Ya puedes iniciar sesión."
        : params.sesion === "cerrada"
          ? "Cerraste sesión correctamente."
          : undefined;

  return (
    <AuthShell
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link className="font-semibold text-sky-800 hover:underline" href="/registro">
            Regístrate
          </Link>
        </>
      }
      subtitle="Accede con el correo y la contraseña que registraste."
      title="Bienvenido de nuevo"
    >
      <LoginForm initialNotice={initialNotice} nextPath={nextPath} />
    </AuthShell>
  );
}

