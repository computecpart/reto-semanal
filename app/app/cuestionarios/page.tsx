import type { Metadata } from "next";
import Link from "next/link";

import { PixelCard, SectionTitle } from "@/components/auth/form-ui";
import { requireSessionPage } from "@/lib/auth/guards";
import { listMyQuizzes, type MyQuiz } from "@/lib/quiz/queries";
import { ATTEMPT_STATUS_LABELS } from "@/lib/quiz/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Trivias",
};

const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: OPERATIONAL_TIME_ZONE,
});

function QuizCard({ quiz }: { quiz: MyQuiz }) {
  const done = quiz.attempt_status && quiz.attempt_status !== "started";
  const label =
    quiz.phase === "upcoming"
      ? `Abre: ${dateFormat.format(new Date(quiz.opens_at))}`
      : quiz.phase === "active"
        ? `Cierra: ${dateFormat.format(new Date(quiz.closes_at))}`
        : `Cerró: ${dateFormat.format(new Date(quiz.closes_at))}`;

  return (
    <li className="pixel-frame-sm flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5">
      <div className="min-w-0">
        <p className="font-bold">{quiz.title}</p>
        <p className="text-xs text-slate-500">
          {label} · {quiz.question_count} preguntas · {Math.round(quiz.duration_seconds / 60)} min · hasta {quiz.max_points} pts
        </p>
        {quiz.attempt_status ? (
          <p className="mt-1 text-xs font-bold uppercase tracking-wide">
            {ATTEMPT_STATUS_LABELS[quiz.attempt_status] ?? quiz.attempt_status}
            {quiz.score !== null ? ` · ${quiz.score} pts` : ""}
          </p>
        ) : null}
      </div>
      {quiz.phase === "upcoming" ? null : (
        <Link
          className={`pixel-button px-4 py-2 text-sm font-bold uppercase tracking-wide ${quiz.phase === "active" && !done ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "bg-white"}`}
          href={`/app/cuestionarios/${quiz.id}`}
        >
          {quiz.phase === "active" && !done ? (quiz.attempt_status === "started" ? "Continuar" : "Responder") : "Ver resultado"}
        </Link>
      )}
    </li>
  );
}

function Group({ empty, quizzes, title }: { empty: string; quizzes: MyQuiz[]; title: string }) {
  return (
    <PixelCard>
      <SectionTitle>{title}</SectionTitle>
      {quizzes.length === 0 ? (
        <p className="text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </ul>
      )}
    </PixelCard>
  );
}

export default async function QuizzesPage() {
  await requireSessionPage("/app/cuestionarios");
  const quizzes = await listMyQuizzes();

  return (
    <div className="space-y-8">
      <header>
        <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
          Retos
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight">Trivias</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Un intento puntuable por trivia. Las respuestas correctas suman y las incorrectas no restan.
        </p>
      </header>
      <Group empty="No hay trivias abiertas en este momento." quizzes={quizzes.filter((quiz) => quiz.phase === "active")} title="Disponibles" />
      <Group empty="Pronto anunciaremos nuevas trivias." quizzes={quizzes.filter((quiz) => quiz.phase === "upcoming")} title="Próximas" />
      <Group empty="Aún no hay trivias finalizadas." quizzes={quizzes.filter((quiz) => quiz.phase === "ended")} title="Finalizadas" />
    </div>
  );
}
