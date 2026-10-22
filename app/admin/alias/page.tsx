import type { Metadata } from "next";

import { ActionForm } from "@/components/admin/action-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { upsertBlockedTermAction } from "@/lib/moderation/actions";
import { listAliasConflicts, listBlockedTerms } from "@/lib/moderation/queries";

export const metadata: Metadata = {
  title: "Moderación de alias | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export default async function AliasModerationPage() {
  await requireAdminPage();
  const [terms, conflicts] = await Promise.all([listBlockedTerms(), listAliasConflicts()]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Moderación de alias</h1>
        <p className="mt-1 text-sm text-slate-600">
          PostgreSQL rechaza los alias que contienen estos términos (también con números o variantes como «4dm1n»). Los
          cambios quedan auditados. Los alias existentes nunca se renombran solos: revísalos abajo.
        </p>
      </header>

      <section className={card}>
        <h2 className="mb-3 text-lg font-bold">Añadir o reactivar término</h2>
        <ActionForm action={upsertBlockedTermAction} submitLabel="Guardar">
          <input aria-label="Término" className={input} maxLength={40} name="term" placeholder="solo letras, sin acentos" />
          <select aria-label="Categoría" className={input} defaultValue="offensive" name="category">
            <option value="offensive">Ofensivo</option>
            <option value="reserved">Reservado</option>
          </select>
        </ActionForm>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Alias existentes que coinciden ({conflicts.length})</h2>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Ningún alias registrado coincide con la lista actual.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {conflicts.map((conflict) => (
              <li className="py-2" key={conflict.user_id}>
                <span className="font-semibold">@{conflict.alias}</span> · {conflict.full_name} ·{" "}
                <span className="font-mono text-xs">{conflict.passport_code}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Contacta a la persona para que cambie su alias desde su perfil; si no responde, evalúa suspenderla en Participantes.
        </p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Términos ({terms.length})</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {terms.map((term) => (
            <li className={`rounded-lg border p-3 text-sm ${term.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-60"}`} key={term.term}>
              <ActionForm action={upsertBlockedTermAction} className="flex items-center justify-between gap-2" submitLabel={term.active ? "Desactivar" : "Activar"} tone={term.active ? "danger" : "primary"}>
                <span>
                  <span className="font-mono font-semibold">{term.term}</span>
                  <span className="ml-2 text-xs text-slate-500">{term.category === "reserved" ? "reservado" : "ofensivo"}</span>
                </span>
                <input name="term" type="hidden" value={term.term} />
                <input name="category" type="hidden" value={term.category} />
                <input name="active" type="hidden" value={term.active ? "off" : "on"} />
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
