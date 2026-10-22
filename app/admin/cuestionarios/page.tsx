import type { Metadata } from "next";
import Link from "next/link";

import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminQuizzes } from "@/lib/quiz/queries";
import { QUIZ_STATUS_LABELS } from "@/lib/quiz/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Cuestionarios | Administración",
};

const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});

function isActive(quiz: { closes_at: string; opens_at: string; status: string }, now: number): boolean {
  return quiz.status === "scheduled" && now >= Date.parse(quiz.opens_at) && now < Date.parse(quiz.closes_at);
}

export default async function AdminQuizzesPage() {
  await requireAdminPage();
  const quizzes = await getAdminQuizzes();
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request.
  const now = Date.now();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cuestionarios</h1>
          <p className="mt-1 text-sm text-slate-600">
            Un cuestionario programado está activo entre su apertura y su cierre. Con el primer intento
            sus preguntas se bloquean.
          </p>
        </div>
        <Link
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          href="/admin/cuestionarios/nuevo"
        >
          Nuevo cuestionario
        </Link>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Apertura</th>
              <th className="px-4 py-3">Cierre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quizzes.map((quiz) => (
              <tr key={quiz.id}>
                <td className="px-4 py-3">
                  <Link className="font-semibold text-sky-800 hover:underline" href={`/admin/cuestionarios/${quiz.id}`}>
                    {quiz.title}
                  </Link>
                  {quiz.locked_at ? <span className="ml-2 text-xs text-slate-500">bloqueado</span> : null}
                </td>
                <td className="px-4 py-3">
                  {isActive(quiz, now) ? "Activo ahora" : (QUIZ_STATUS_LABELS[quiz.status] ?? quiz.status)}
                </td>
                <td className="px-4 py-3">{dateFormat.format(new Date(quiz.opens_at))}</td>
                <td className="px-4 py-3">{dateFormat.format(new Date(quiz.closes_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {quizzes.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Aún no hay cuestionarios.</p> : null}
      </section>
    </div>
  );
}
