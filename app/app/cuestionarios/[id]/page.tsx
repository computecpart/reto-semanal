import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { readableDigits } from "@/components/ui/readable-digits";
import { PixelCard } from "@/components/auth/form-ui";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { QuizResultView } from "@/components/quiz/quiz-result";
import { requireSessionPage } from "@/lib/auth/guards";
import { getQuizResult, listMyQuizzes } from "@/lib/quiz/queries";

export const metadata: Metadata = {
  title: "Trivia",
};

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSessionPage("/app/cuestionarios");
  const quizzes = await listMyQuizzes();
  const quiz = quizzes.find((item) => item.id === id);

  if (!quiz) {
    notFound();
  }

  const finished = quiz.attempt_status !== null && quiz.attempt_status !== "started";
  const result = finished || quiz.phase === "ended" ? await getQuizResult(quiz.id) : null;

  return (
    <div className="space-y-8">
      <Link className="inline-flex min-h-10 items-center text-sm font-bold text-[var(--accent-strong)] hover:underline" href="/app/cuestionarios">
        ← Todas las trivias
      </Link>
      <header>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{readableDigits(quiz.title)}</h1>
        {quiz.description ? <p className="mt-3 max-w-2xl whitespace-pre-line text-slate-600">{quiz.description}</p> : null}
      </header>

      {result ? (
        <QuizResultView result={result} />
      ) : quiz.phase === "active" ? (
        <QuizPlayer
          intro={{ duration_seconds: quiz.duration_seconds, max_points: quiz.max_points, question_count: quiz.question_count }}
          quizId={quiz.id}
        />
      ) : (
        <PixelCard>
          <p className="text-slate-600">
            {quiz.phase === "upcoming" ? "Esta trivia aún no ha abierto." : "Esta trivia ya cerró y no participaste."}
          </p>
        </PixelCard>
      )}
    </div>
  );
}
