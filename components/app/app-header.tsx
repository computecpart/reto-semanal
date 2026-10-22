import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { getAvatar } from "@/lib/avatars";
import type { AppRole } from "@/lib/permissions/roles";
import { isAdministrativeRole } from "@/lib/permissions/roles";

import { NavLinks } from "./nav-links";
import { PixelIcon } from "./pixel-icons";

const PARTICIPANT_NAV = [
  { href: "/app/perfil", icon: <PixelIcon name="passport" />, label: "Mi pasaporte", shortLabel: "Pasaporte" },
  { href: "/app/cuestionarios", icon: <PixelIcon name="quiz" />, label: "Trivias" },
  { href: "/app/canjear", icon: <PixelIcon name="qr" />, label: "Canjear" },
  { href: "/app/puntos", icon: <PixelIcon name="points" />, label: "Puntos" },
  { href: "/app/ranking", icon: <PixelIcon name="trophy" />, label: "Ranking" },
];

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

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
    <>
      <header className="border-b-4 border-[var(--color-ink)] bg-[var(--color-paper)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link className={`flex min-h-10 min-w-0 items-center font-display text-base leading-tight sm:text-xl ${focusRing}`} href="/">
            <span className="line-clamp-2">{campaignName}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            {isAdministrativeRole(role) ? (
              <Link
                className={`inline-flex min-h-10 items-center border-2 border-[var(--color-ink)] bg-[var(--color-ink)] px-3 font-bold text-white hover:opacity-90 ${focusRing}`}
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <Link
              aria-label={alias ? `Mi pasaporte, @${alias}` : "Mi pasaporte"}
              className={`flex min-h-10 items-center gap-2 font-bold ${focusRing}`}
              href="/app/perfil"
            >
              {avatar ? (
                <Image alt="" className="pixelated border-2 border-[var(--color-ink)] bg-white" height={36} src={avatar.src} unoptimized width={36} />
              ) : null}
              <span className="hidden max-w-40 truncate md:inline">{alias ? `@${alias}` : "Participante"}</span>
            </Link>
            <form action={signOutAction}>
              <button
                className={`inline-flex min-h-10 items-center border-2 border-[var(--color-ink)] bg-white px-3 font-bold hover:bg-[var(--accent-soft)] ${focusRing}`}
                type="submit"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Secciones" className="mx-auto hidden w-full max-w-5xl gap-2 px-6 pb-4 sm:flex">
          <NavLinks
            activeClassName="bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[3px_3px_0_0_var(--color-ink)]"
            className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap border-2 border-[var(--color-ink)] px-3 text-sm font-bold uppercase tracking-wide ${focusRing}`}
            inactiveClassName="bg-white text-[var(--color-ink)] hover:bg-[var(--accent-soft)]"
            items={PARTICIPANT_NAV}
          />
        </nav>
      </header>

      {/* Thumb-friendly tab bar on phones; the top pills take over from `sm`. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t-4 border-[var(--color-ink)] bg-[var(--color-paper)] pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <NavLinks
          activeClassName="bg-[var(--accent)] text-[var(--accent-contrast)]"
          className={`flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[0.68rem] font-bold uppercase leading-none tracking-wide ${focusRing} focus-visible:-outline-offset-4`}
          compact
          inactiveClassName="text-[var(--color-ink)] active:bg-[var(--accent-soft)]"
          items={PARTICIPANT_NAV}
        />
      </nav>
    </>
  );
}
