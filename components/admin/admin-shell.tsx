import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { NavLinks } from "@/components/app/nav-links";
import { signOutAction } from "@/lib/auth/actions";
import { getAvatar } from "@/lib/avatars";
import type { AppRole } from "@/lib/permissions/roles";

const ADMIN_NAV = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/campana", label: "Campañas" },
  { href: "/admin/cuestionarios", label: "Cuestionarios" },
  { href: "/admin/revisiones", label: "Revisiones" },
  { href: "/admin/misiones", label: "Misiones" },
  { href: "/admin/ranking", label: "Ranking y puntos" },
  { href: "/admin/participantes", label: "Participantes" },
  { href: "/admin/alias", label: "Alias" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

// Hidden from admins; the RPCs enforce superadmin regardless.
const SUPERADMIN_NAV = [
  { href: "/admin/administradores", label: "Administradores" },
  { href: "/admin/rifa", label: "Rifa" },
];

const ROLE_LABELS: Readonly<Record<AppRole, string>> = {
  admin: "Administrador",
  participant: "Participante",
  superadmin: "Superadministrador",
};

export function AdminShell({
  alias,
  avatarId,
  children,
  role,
}: {
  alias: string | null;
  avatarId: string | null;
  children: ReactNode;
  role: AppRole;
}) {
  const avatar = getAvatar(avatarId);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:py-6">
          <Link className="block" href="/admin">
            <span className="mb-2 inline-flex rounded-md bg-white px-2 py-1">
              <Image alt="Digit@l Solutions" className="h-10 w-auto lg:h-14" height={56} src="/brand/digital-solutions.png" unoptimized width={74} />
            </span>
            <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Consola</span>
            <span className="block text-lg font-bold text-white">Reto Semanal</span>
          </Link>
          <Link className="inline-flex min-h-10 shrink-0 items-center text-sm font-semibold text-sky-300 hover:text-white lg:mt-2" href="/" target="_blank">
            Ver sitio público ↗
          </Link>
        </div>

        <nav aria-label="Administración" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
          <NavLinks
            activeClassName="bg-slate-800 text-white"
            className="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-sky-400"
            inactiveClassName="text-slate-300 hover:bg-slate-900 hover:text-white"
            exact={["/admin"]}
            items={role === "superadmin" ? [...ADMIN_NAV, ...SUPERADMIN_NAV] : ADMIN_NAV}
          />
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-2 text-xs font-semibold lg:hidden">
          <span className="min-w-0 truncate text-slate-300">
            {alias ? `@${alias}` : "Cuenta"} · {ROLE_LABELS[role]}
          </span>
          <div className="flex shrink-0 gap-2">
            <Link className="inline-flex min-h-9 items-center rounded-md border border-slate-700 px-2.5 hover:bg-slate-900" href="/app/perfil">
              Mi perfil
            </Link>
            <form action={signOutAction}>
              <button className="inline-flex min-h-9 items-center rounded-md border border-slate-700 px-2.5 hover:bg-slate-900" type="submit">
                Salir
              </button>
            </form>
          </div>
        </div>

        <div className="hidden border-t border-slate-800 p-4 lg:block">
          <div className="flex items-center gap-3">
            {avatar ? (
              <Image alt="" className="pixelated rounded-md" height={36} src={avatar.src} unoptimized width={36} />
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{alias ? `@${alias}` : "Cuenta"}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs font-semibold">
            <Link className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-900" href="/app/perfil">
              Mi perfil
            </Link>
            <form action={signOutAction}>
              <button className="rounded-md border border-slate-700 px-2.5 py-1.5 hover:bg-slate-900" type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
