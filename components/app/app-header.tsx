import Image from "next/image";
import Link from "next/link";

import { signOutAction } from "@/lib/auth/actions";
import { getAvatar } from "@/lib/avatars";
import type { AppRole } from "@/lib/permissions/roles";
import { isAdministrativeRole } from "@/lib/permissions/roles";

export function AppHeader({
  alias,
  avatarId,
  role,
}: {
  alias: string | null;
  avatarId: string | null;
  role: AppRole;
}) {
  const avatar = getAvatar(avatarId);

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link className="text-base font-bold tracking-tight text-slate-950" href="/app/perfil">
          Reto Semanal
        </Link>

        <nav aria-label="Cuenta" className="flex flex-wrap items-center gap-3 text-sm">
          {isAdministrativeRole(role) ? (
            <Link className="font-semibold text-sky-800 hover:underline" href="/admin">
              Administración
            </Link>
          ) : null}

          <span className="flex items-center gap-2 font-semibold text-slate-700">
            {avatar ? (
              <Image
                alt=""
                className="rounded-md [image-rendering:pixelated]"
                height={28}
                src={avatar.src}
                unoptimized
                width={28}
              />
            ) : null}
            {alias ?? "Participante"}
          </span>

          <form action={signOutAction}>
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              type="submit"
            >
              Cerrar sesión
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
