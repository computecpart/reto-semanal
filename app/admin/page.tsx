import type { Metadata } from "next";

import { requireAdminPage } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Administración | Reto Semanal",
};

export default async function AdminPage() {
  // Each admin page re-checks the role: layouts are not re-run on every
  // client navigation, so they are not a sufficient boundary on their own.
  const { role } = await requireAdminPage();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
        {role === "superadmin" ? "Superadministrador" : "Administrador"}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Administración</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        El acceso está verificado contra el rol almacenado en PostgreSQL. Las herramientas de
        gestión se habilitarán en fases posteriores.
      </p>
    </section>
  );
}
