import Link from "next/link";
import type { ReactNode } from "react";

import { LegalLinks } from "@/components/legal/legal-page";
import { getSiteBranding } from "@/lib/campaign/queries";
import { themeStyle } from "@/lib/landing/theme";

interface AuthShellProps {
  children: ReactNode;
  eyebrow?: string;
  footer?: ReactNode;
  subtitle: string;
  title: string;
  wide?: boolean;
}

export async function AuthShell({
  children,
  eyebrow = "Cuenta de participante",
  footer,
  subtitle,
  title,
  wide = false,
}: AuthShellProps) {
  const branding = await getSiteBranding();

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]"
      style={themeStyle(branding.theme)}
    >
      <header className="border-b-4 border-[var(--color-ink)] bg-[var(--color-paper)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            className="font-display text-lg leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] sm:text-xl"
            href="/"
          >
            {branding.name}
          </Link>
          <nav aria-label="Cuenta" className="flex shrink-0 items-center gap-4 text-sm font-semibold">
            <Link className="underline-offset-4 hover:underline" href="/login">
              Iniciar sesión
            </Link>
            <Link className="hidden underline-offset-4 hover:underline sm:inline" href="/registro">
              Registrarse
            </Link>
          </nav>
        </div>
      </header>

      <main className="pixel-grid flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className={`mx-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}>
          <section className="pixel-frame bg-white p-6 sm:p-10">
            <header className="mb-8">
              <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
                {eyebrow}
              </p>
              <h1 className="mt-5 font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{subtitle}</p>
            </header>

            {children}

            {footer ? (
              <footer className="mt-8 border-t-2 border-dashed border-slate-300 pt-6 text-center text-sm text-slate-600">
                {footer}
              </footer>
            ) : null}
          </section>
        </div>
      </main>

      <footer className="border-t-4 border-[var(--color-ink)] px-4 py-6">
        <LegalLinks />
      </footer>
    </div>
  );
}
