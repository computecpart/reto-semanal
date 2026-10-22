import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site/site-header";
import { getSiteBranding } from "@/lib/campaign/queries";
import { themeStyle } from "@/lib/landing/theme";

/** Rules, privacy and acceptance pages, styled like the rest of the campaign. */
export async function LegalPage({
  children,
  eyebrow,
  title,
  updatedAt,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  updatedAt?: string;
}) {
  const branding = await getSiteBranding();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]" style={themeStyle(branding.theme)}>
      <SiteHeader />
      <main className="pixel-grid flex-1 px-4 py-8 sm:px-6 sm:py-14">
        <article className="pixel-frame mx-auto w-full max-w-3xl bg-white p-5 sm:p-10">
          <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
            {eyebrow ?? branding.name}
          </p>
          <h1 className="mt-5 font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
          {updatedAt ? <p className="mt-2 text-sm text-slate-500">{updatedAt}</p> : null}
          <div className="mt-8 space-y-6 text-base leading-7 text-slate-700 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
            {children}
          </div>
        </article>
      </main>
      <footer className="border-t-4 border-[var(--color-ink)] px-4 py-6">
        <LegalLinks />
      </footer>
    </div>
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
