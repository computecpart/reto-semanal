import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionForm } from "@/components/admin/action-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { runRaffleAction } from "@/lib/moderation/actions";
import { getRafflePreview } from "@/lib/moderation/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Rifa | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const input = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "long", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE });

export default async function RafflePage() {
  const { role } = await requireAdminPage();

  if (role !== "superadmin") {
    redirect("/admin");
  }

  const preview = await getRafflePreview();
  const listDataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(preview.eligible_codes.join(","))}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Rifa final</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reglas 8 y 11: cada participante elegible tiene una sola oportunidad, sin importar sus puntos. Elegibles: rol
          participante, perfil completo y no descalificado ni archivado.
        </p>
      </header>

      <section className={card}>
        <h2 className="text-lg font-bold">1. Publica la lista antes del sorteo</h2>
        <p className="mt-1 text-sm text-slate-600">
          {preview.eligible_count} elegibles. Huella SHA-256 de la lista (identificadores MSI Passport ordenados y separados por
          comas):
        </p>
        <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs">{preview.eligible_hash}</p>
        <a className="mt-3 inline-block text-sm font-semibold text-sky-800 underline" download="elegibles-rifa.txt" href={listDataUrl}>
          Descargar lista de elegibles
        </a>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">2. Sortea con una semilla pública</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Usa un valor que nadie conozca de antemano y que todos puedan comprobar, por ejemplo el número ganador de una
          lotería anunciado ese día o un número dicho en vivo por el público. El primero es el ganador; los demás, suplentes en
          orden.
        </p>
        <ActionForm action={runRaffleAction} confirm="¿Realizar el sorteo? Quedará registrado de forma permanente." submitLabel="Sortear">
          <input aria-label="Semilla pública" className={`${input} min-w-72 flex-1`} maxLength={200} name="seed" placeholder="Ej.: Lotería Nacional 11/12/2026 número 4821" />
          <label className="flex items-center gap-2 text-sm">
            Ganador + suplentes
            <input className={`${input} w-20`} defaultValue={3} max={20} min={1} name="winners" type="number" />
          </label>
        </ActionForm>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Sorteos registrados</h2>
        {preview.draws.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aún no se ha realizado ningún sorteo.</p>
        ) : (
          <ul className="mt-3 space-y-4 text-sm">
            {preview.draws.map((draw) => (
              <li className="rounded-xl border border-slate-200 p-4" key={draw.id}>
                <p className="text-xs text-slate-500">
                  {dateFormat.format(new Date(draw.drawn_at))} · semilla «{draw.public_seed}» · {draw.eligible_count} elegibles
                </p>
                <ol className="mt-2 list-decimal pl-5">
                  {draw.winners.map((winner) => (
                    <li key={winner.position}>
                      <span className="font-semibold">{winner.position === 1 ? "Ganador" : `Suplente ${winner.position - 1}`}:</span>{" "}
                      <span className="font-mono">{winner.passport_code}</span> {winner.alias ? `(@${winner.alias})` : ""}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 break-all font-mono text-[11px] text-slate-500">Huella: {draw.eligible_hash}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Verificación: con la lista publicada y la semilla, cualquiera puede recalcular el resultado con el algoritmo descrito en
          docs/campaign/rifa-verificable.md.
        </p>
      </section>
    </div>
  );
}
