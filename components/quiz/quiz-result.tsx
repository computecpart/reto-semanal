import type { QuizResult } from "@/lib/quiz/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});

export function QuizResultView({ result }: { result: QuizResult }) {
  const pendingReview = result.status === "submitted_pending_review";

  return (
    <div className="space-y-6">
      <section className="pixel-frame bg-[var(--accent)] p-6 text-[var(--accent-contrast)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em]">
          {result.status === "invalidated" ? "Participación sin puntuación" : "Cuestionario enviado"}
        </p>
        {result.score !== null ? (
          <p className="mt-2 font-score text-5xl leading-none">
            {result.score}
            <span className="ml-2 text-2xl">pts</span>
          </p>
        ) : (
          <p className="mt-2 font-display text-2xl">Resultado reservado por el equipo organizador</p>
        )}
        {result.score !== null ? (
          <p className="mt-3 text-sm">
            Aciertos: {result.correct_count ?? 0} · Trivia: {result.auto_score ?? 0} · Bono de velocidad: {result.bonus_score ?? 0}
            {pendingReview ? " · Respuestas abiertas en revisión" : ` · Revisión: ${result.review_score ?? 0}`}
          </p>
        ) : null}
        {result.finalized_late ? (
          <p className="mt-2 text-sm">El tiempo terminó: se calificó lo que guardaste antes del plazo.</p>
        ) : null}
      </section>

      {result.solutions_available && result.solutions ? (
        <section className="pixel-frame bg-white p-5 sm:p-8">
          <h2 className="font-display text-2xl">Soluciones</h2>
          <ol className="mt-6 space-y-5">
            {result.solutions.map((solution, index) => (
              <li className="border-l-4 border-[var(--accent)] pl-4" key={index}>
                <p className="font-bold">
                  {index + 1}. {solution.prompt}
                </p>
                {solution.type === "multiple_choice" ? (
                  <p className="mt-1 text-sm">
                    Tu respuesta: <strong>{solution.your_option ?? "Sin responder"}</strong>{" "}
                    {solution.is_correct ? "✓" : `· Correcta: ${solution.correct_option ?? "—"}`}
                  </p>
                ) : (
                  <p className="mt-1 text-sm">
                    Tu respuesta: {solution.your_text || "Sin responder"} · Puntos de revisión:{" "}
                    {solution.review_points ?? "pendiente"}
                  </p>
                )}
                {solution.explanation ? <p className="mt-1 text-sm text-slate-600">{solution.explanation}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : result.status !== "invalidated" ? (
        <p className="text-sm text-slate-600">
          Las soluciones se publicarán después del cierre ({dateFormat.format(new Date(result.closes_at))}) si el
          cuestionario lo permite.
        </p>
      ) : null}
    </div>
  );
}
