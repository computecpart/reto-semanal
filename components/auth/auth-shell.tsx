import Link from "next/link";
import type { ReactNode } from "react";

import { LegalLinks } from "@/components/legal/legal-page";

interface AuthShellProps {
  children: ReactNode;
  footer?: ReactNode;
  subtitle: string;
  title: string;
}

export function AuthShell({ children, footer, subtitle, title }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_44%,#eef2ff_100%)] px-4 py-10 text-slate-950 sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 transition hover:text-sky-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700"
          href="/"
        >
          <span aria-hidden="true">←</span>
          Reto Semanal
        </Link>

        <section className="mt-7 rounded-3xl border border-white/80 bg-white/95 p-6 shadow-xl shadow-slate-900/5 sm:p-10">
          <header className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Cuenta de participante
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {subtitle}
            </p>
          </header>

          {children}

          {footer ? (
            <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              {footer}
            </footer>
          ) : null}
        </section>

        <div className="mt-6">
          <LegalLinks />
        </div>
      </div>
    </main>
  );
}

