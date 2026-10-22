import Link from "next/link";

import { LegalLinks } from "@/components/legal/legal-page";
import { SiteHeader } from "@/components/site/site-header";
import { getSiteBranding } from "@/lib/campaign/queries";
import { themeStyle } from "@/lib/landing/theme";

export default async function NotFound() {
  const branding = await getSiteBranding();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]" style={themeStyle(branding.theme)}>
      <SiteHeader />
      <main className="pixel-grid flex flex-1 items-center justify-center px-4 py-12">
        <section className="pixel-frame max-w-md bg-white p-8 text-center">
          <p className="font-score text-6xl">404</p>
          <h1 className="mt-4 font-display text-2xl">Esta página no existe</h1>
          <p className="mt-2 text-slate-600">Puede que el enlace haya cambiado o ya no esté disponible.</p>
          <Link
            className="pixel-button mt-6 inline-flex min-h-12 items-center bg-[var(--accent)] px-5 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)]"
            href="/"
          >
            Volver al inicio
          </Link>
        </section>
      </main>
      <footer className="border-t-4 border-[var(--color-ink)] px-4 py-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
