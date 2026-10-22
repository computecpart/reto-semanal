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
          className="inline-flex min-h-10 items-center text-sm font-semibold text-sky-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700"
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

const footerLink =
  "inline-flex min-h-10 items-center font-semibold underline-offset-4 opacity-75 transition hover:text-[var(--accent-strong,currentColor)] hover:underline hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent,currentColor)]";

export function OrganizerBadge() {
  return (
    <a
      className="group inline-flex max-w-full items-center gap-3 rounded-lg border-2 border-[var(--color-ink)] bg-white px-3 py-3 sm:gap-4 sm:px-4 text-left text-[var(--color-ink)] shadow-[4px_4px_0_0_var(--accent,var(--color-ink))] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent,currentColor)]"
      href="mailto:soporte@digitalsolutions.com.sv"
    >
      <Image alt="" className="h-12 w-auto shrink-0 sm:h-14" height={56} src="/brand/digital-solutions.png" unoptimized width={74} />
      <span className="min-w-0 border-l-2 border-slate-200 pl-3 sm:pl-4">
        <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Organiza</span>
        <span className="block font-bold leading-tight">Digit@l Solutions</span>
        <span className="block truncate text-[11px] text-slate-600 sm:text-xs group-hover:text-[var(--accent-strong,currentColor)] group-hover:underline">
          soporte@digitalsolutions.com.sv
        </span>
      </span>
    </a>
  );
}

export function LegalLinks() {
  return (
    <div className="flex flex-col items-center gap-4">
      <OrganizerBadge />
      <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-x-5 text-sm">
        <Link className={footerLink} href="/reglas">
          Reglas de participación
        </Link>
        <Link className={footerLink} href="/privacidad">
          Política de privacidad
        </Link>
      </nav>
    </div>
  );
}
