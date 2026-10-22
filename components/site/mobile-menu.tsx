"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { SiteNavLink } from "./site-header";

/** Full-width disclosure menu for phones; links close it on navigation. */
export function MobileMenu({ links, signedIn }: { links: readonly SiteNavLink[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  const item =
    "flex min-h-12 items-center border-b border-[color-mix(in_srgb,var(--frame)_25%,transparent)] px-1 text-base font-semibold hover:text-[var(--accent-strong)]";
  const button = "pixel-button inline-flex min-h-12 items-center justify-center px-5 text-sm font-bold uppercase tracking-wide";

  return (
    <div className="xl:hidden">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-2 border-2 border-[var(--frame)] px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" className="size-4" fill="currentColor" shapeRendering="crispEdges" viewBox="0 0 8 8">
          {open ? (
            <path d="M1 1h1v1H1zM2 2h1v1H2zM3 3h2v2H3zM5 2h1v1H5zM6 1h1v1H6zM2 5h1v1H2zM1 6h1v1H1zM5 5h1v1H5zM6 6h1v1H6z" />
          ) : (
            <path d="M0 1h8v1H0zM0 3.5h8v1H0zM0 6h8v1H0z" />
          )}
        </svg>
        {open ? "Cerrar" : "Menú"}
      </button>

      {open ? (
        <nav
          aria-label="Menú principal"
          className="absolute inset-x-0 top-full z-50 border-b-2 border-[var(--frame)] bg-[var(--site-header-bg)] px-4 pb-5 shadow-[0_12px_24px_rgb(0_0_0/0.25)]"
          id={panelId}
        >
          <ul>
            <li>
              <Link className={item} href="/" onClick={close}>
                Inicio
              </Link>
            </li>
            {links.map((link) => (
              <li key={link.href}>
                <Link className={item} href={link.href} onClick={close}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3">
            {signedIn ? (
              <Link className={`${button} bg-[var(--accent)] text-[var(--accent-contrast)]`} href="/app" onClick={close}>
                Mi panel
              </Link>
            ) : (
              <>
                <Link className={`${button} bg-[var(--accent)] text-[var(--accent-contrast)]`} href="/registro" onClick={close}>
                  Crear mi pasaporte
                </Link>
                <Link className={`${button} bg-white text-[var(--color-ink)]`} href="/login" onClick={close}>
                  Iniciar sesión
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
