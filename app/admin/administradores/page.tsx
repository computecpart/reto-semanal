import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionForm } from "@/components/admin/action-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { setRoleAction } from "@/lib/moderation/actions";
import { listStaff } from "@/lib/moderation/queries";

export const metadata: Metadata = {
  title: "Administradores | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const ROLE_LABELS: Readonly<Record<string, string>> = { admin: "Admin", participant: "Participante", superadmin: "Superadmin" };

export default async function AdministratorsPage() {
  const { role } = await requireAdminPage();

  // The RPCs also require superadmin; this only hides the page from admins.
  if (role !== "superadmin") {
    redirect("/admin");
  }

  const staff = await listStaff();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Administradores</h1>
        <p className="mt-1 text-sm text-slate-600">
          Solo un superadmin gestiona roles. Siempre debe quedar al menos un superadmin. Las cuentas de admin no compiten en el
          ranking ni en la rifa. Todo cambio queda en la auditoría.
        </p>
      </header>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Cambiar rol</h2>
        <p className="mb-4 text-sm text-slate-600">La persona debe tener una cuenta registrada con ese correo.</p>
        <ActionForm action={setRoleAction} confirm="¿Cambiar el rol de esta cuenta?" submitLabel="Aplicar">
          <input aria-label="Correo" autoComplete="off" className={`${input} min-w-64`} name="email" placeholder="correo@empresa.com" type="email" />
          <select aria-label="Nuevo rol" className={input} defaultValue="admin" name="role">
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
            <option value="participant">Participante (quitar permisos)</option>
          </select>
          <input aria-label="Motivo" className={`${input} min-w-64 flex-1`} maxLength={500} name="reason" placeholder="Motivo (mín. 10 caracteres)" />
        </ActionForm>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Equipo actual ({staff.length})</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {staff.map((member) => (
            <li className="flex flex-wrap items-center justify-between gap-2 py-2" key={member.user_id}>
              <span>
                <span className="font-semibold">{member.alias ? `@${member.alias}` : member.email}</span>
                {member.full_name ? ` · ${member.full_name}` : ""} · <span className="text-slate-500">{member.email}</span>
              </span>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-900">{ROLE_LABELS[member.role] ?? member.role}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Recomendación: que cada cuenta administrativa use una contraseña única y, cuando se habilite, verificación en dos pasos.
        </p>
      </section>
    </div>
  );
}
