"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { signOutAction } from "@/lib/auth/actions";

const LINKS = [
  { href: "/app/perfil", label: "Mi pasaporte" },
  { href: "/", label: "Portada de la campaña" },
  { href: "/reglas", label: "Reglas de participación" },
  { href: "/privacidad", label: "Política de privacidad" },
] as const;

/** Account dropdown of the participant header: profile, campaign pages and sign out. */
export function AccountMenu({
  alias,
  avatarSrc,
  isAdmin,
}: {
  alias: string | null;
  avatarSrc: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

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
    "flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold hover:bg-[var(--accent-soft)] focus-visible:bg-[var(--accent-soft)] focus-visible:outline-none";

  return (
    <div className="relative">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-label={alias ? `Menú de la cuenta @${alias}` : "Menú de la cuenta"}
        className="flex min-h-10 items-center gap-2 border-2 border-[var(--color-ink)] bg-white py-0.5 pr-2 pl-0.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {avatarSrc ? <Image alt="" className="pixelated bg-white" height={32} src={avatarSrc} unoptimized width={32} /> : null}
        <span className="hidden max-w-36 truncate md:inline">{alias ? `@${alias}` : "Mi cuenta"}</span>
        <svg aria-hidden="true" className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" shapeRendering="crispEdges" viewBox="0 0 6 4">
          <path d="M0 0h6v1H0zM1 1h4v1H1zM2 2h2v1H2z" />
        </svg>
      </button>

      {open ? (
        <>
          {/* Click-away layer. */}
          <button aria-hidden="true" className="fixed inset-0 z-40 cursor-default" onClick={close} tabIndex={-1} type="button" />
          <div
            className="pixel-frame-sm absolute right-0 z-50 mt-2 w-64 bg-white py-2 text-[var(--color-ink)]"
            id={menuId}
          >
            {alias ? <p className="truncate px-4 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">@{alias}</p> : null}
            {isAdmin ? (
              <Link className={item} href="/admin" onClick={close}>
                Consola de administración
              </Link>
            ) : null}
            {LINKS.map((link) => (
              <Link className={item} href={link.href} key={link.href} onClick={close}>
                {link.label}
              </Link>
            ))}
            <form action={signOutAction} className="mt-1 border-t border-slate-200 pt-1">
              <button className={`${item} text-red-700`} type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
