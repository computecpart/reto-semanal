import type { Metadata } from "next";

import { ReviewForm } from "@/components/admin/review-form";
import { requireAdminPage } from "@/lib/auth/guards";
import { getReviewQueue } from "@/lib/quiz/queries";

export const metadata: Metadata = {
  title: "Revisiones | Administración",
};

const STATUS: Readonly<Record<string, string>> = {
  approved: "Aprobada",
  partial: "Parcial",
  pending: "Pendiente",
  rejected: "Rechazada",
};

export default async function ReviewsPage() {
  await requireAdminPage();
  const items = await getReviewQueue();
  const pending = items.filter((item) => item.review_status === "pending").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Revisiones</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pending} pendientes. Mientras haya pendientes, el ranking se muestra como provisional. Cambiar
          una decisión ya puntuada crea una corrección; nunca se edita el movimiento original.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No hay respuestas abiertas.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={`${item.attempt_id}-${item.question_id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {item.quiz_title} · @{item.alias} · {item.passport_code}
                  </p>
                  <p className="mt-1 font-semibold">{item.prompt}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.review_status === "pending" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
                >
                  {STATUS[item.review_status]}
                  {item.review_points !== null ? ` · ${item.review_points}/${item.max_points}` : ""}
                </span>
              </div>
              <blockquote className="my-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{item.text_answer}</blockquote>
              <ReviewForm
                attemptId={item.attempt_id}
                currentNote={item.review_note}
                currentPoints={item.review_points}
                maxPoints={item.max_points}
                questionId={item.question_id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
