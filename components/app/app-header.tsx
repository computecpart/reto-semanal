import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { getAvatar } from "@/lib/avatars";
import type { AppRole } from "@/lib/permissions/roles";
import { isAdministrativeRole } from "@/lib/permissions/roles";

import { NavLinks } from "./nav-links";

const PARTICIPANT_NAV = [
  { href: "/app/perfil", label: "Mi pasaporte" },
  { href: "/app/puntos", label: "Puntos" },
  { href: "/app/ranking", label: "Ranking" },
] as const;

export function AppHeader({
  alias,
  avatarId,
  campaignName,
  role,
}: {
  alias: string | null;
  avatarId: string | null;
  campaignName: string;
  role: AppRole;
}) {
  const avatar = getAvatar(avatarId);

  return (
    <header className="border-b-4 border-[var(--color-ink)] bg-[var(--color-paper)]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <Link
          className="font-display text-lg leading-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] sm:text-xl"
          href="/"
        >
          {campaignName}
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {isAdministrativeRole(role) ? (
            <Link
              className="border-2 border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 font-bold text-white hover:opacity-90"
              href="/admin"
            >
              Administración
            </Link>
          ) : null}
          <span className="hidden items-center gap-2 font-bold sm:flex">
            {avatar ? <Image alt="" className="pixelated" height={28} src={avatar.src} unoptimized width={28} /> : null}
            {alias ? `@${alias}` : "Participante"}
          </span>
          <form action={signOutAction}>
            <button
              className="border-2 border-[var(--color-ink)] bg-white px-3 py-1.5 font-bold hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              type="submit"
            >
              Salir
            </button>
          </form>
        </div>

        <nav aria-label="Secciones" className="-mx-1 flex w-full gap-2 overflow-x-auto pb-1">
          <NavLinks
            activeClassName="bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[3px_3px_0_0_var(--color-ink)]"
            className="whitespace-nowrap border-2 border-[var(--color-ink)] bg-white px-3 py-1.5 text-sm font-bold uppercase tracking-wide"
            items={PARTICIPANT_NAV}
          />
        </nav>
      </div>
    </header>
  );
}
