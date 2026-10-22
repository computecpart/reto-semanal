import Link from "next/link";

import { getAvatar } from "@/lib/avatars";
import type { AppRole } from "@/lib/permissions/roles";
import { isAdministrativeRole } from "@/lib/permissions/roles";

import { AccountMenu } from "./account-menu";
import { NavLinks } from "./nav-links";
import { PixelIcon } from "./pixel-icons";

const PARTICIPANT_NAV = [
  { href: "/app", icon: <PixelIcon name="home" />, label: "Inicio" },
  { href: "/app/cuestionarios", icon: <PixelIcon name="quiz" />, label: "Trivias" },
  { href: "/app/canjear", icon: <PixelIcon name="qr" />, label: "Canjear" },
  { href: "/app/ranking", icon: <PixelIcon name="trophy" />, label: "Ranking" },
  { href: "/app/puntos", icon: <PixelIcon name="points" />, label: "Puntos" },
  { href: "/app/perfil", icon: <PixelIcon name="passport" />, label: "Mi pasaporte", shortLabel: "Pasaporte" },
];

// Five thumb-sized tabs on phones; "Puntos" stays reachable from Inicio and the account menu.
const MOBILE_NAV = PARTICIPANT_NAV.filter((item) => item.href !== "/app/puntos");

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

          <AccountMenu alias={alias} avatarSrc={avatar?.src ?? null} isAdmin={isAdministrativeRole(role)} />
        </div>

        <nav aria-label="Secciones" className="mx-auto hidden w-full max-w-5xl flex-wrap gap-2 px-6 pb-4 sm:flex">
          <NavLinks
            activeClassName="bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[3px_3px_0_0_var(--color-ink)]"
            className={`inline-flex min-h-10 items-center gap-2 whitespace-nowrap border-2 border-[var(--color-ink)] px-3 text-sm font-bold uppercase tracking-wide ${focusRing}`}
            exact={["/app"]}
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
          exact={["/app"]}
          inactiveClassName="text-[var(--color-ink)] active:bg-[var(--accent-soft)]"
          items={MOBILE_NAV}
        />
      </nav>
    </>
  );
}
