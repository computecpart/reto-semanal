import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  children,
  title,
  updatedAt,
}: {
  children: ReactNode;
  title: string;
  updatedAt: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700"
          href="/"
        >
          <span aria-hidden="true">← </span>Reto Semanal
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {updatedAt}</p>
        <div className="mt-8 space-y-6 text-base leading-7 text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </main>
  );
}

export function OrganizerBadge() {
  return (
    <a
      className="inline-flex items-center gap-3 rounded-sm border-2 border-[var(--color-ink)] bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600"
      href="mailto:soporte@digitalsolutions.com.sv"
    >
      Organiza
      <Image alt="Digit@l Solutions" className="h-6 w-auto" height={24} src="/brand/digital-solutions.svg" unoptimized width={132} />
    </a>
  );
}

export function LegalLinks() {
  return (
    <div className="flex flex-col items-center gap-4">
      <OrganizerBadge />
      <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
      <Link className="font-semibold text-slate-600 hover:text-slate-950 hover:underline" href="/reglas">
        Reglas de participación
      </Link>
      <Link className="font-semibold text-slate-600 hover:text-slate-950 hover:underline" href="/privacidad">
        Política de privacidad
      </Link>
      </nav>
    </div>
  );
}
