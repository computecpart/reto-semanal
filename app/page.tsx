import Link from "next/link";

import { FoundationStatus } from "@/components/foundation-status";
import { LegalLinks } from "@/components/legal/legal-page";

const steps = [
  "Crea tu cuenta con tu correo y elige tu alias",
  "Confirma tu correo con el código que te enviamos",
  "Elige uno de los avatares oficiales",
  "Prepárate para los retos de cada semana",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f8fafc_42%,#eef2ff_100%)] px-6 py-16 text-slate-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
            Campaña de participación
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Reto Semanal
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 sm:text-xl">
            Crea tu cuenta, verifica tu correo y prepárate para los retos de la campaña.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href="/registro"
            >
              Crear cuenta
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              href="/login"
            >
              Iniciar sesión
            </Link>
          </div>
        </header>

        <section
          aria-labelledby="steps-heading"
          className="grid gap-4 sm:grid-cols-2"
        >
          <h2 id="steps-heading" className="sr-only">
            Cómo participar
          </h2>
          {steps.map((step) => (
            <FoundationStatus key={step}>{step}</FoundationStatus>
          ))}
        </section>

        <footer className="border-t border-slate-200 pt-6">
          <LegalLinks />
        </footer>
      </div>
    </main>
  );
}
