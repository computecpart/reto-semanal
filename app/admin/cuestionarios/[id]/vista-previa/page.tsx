import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuizPlayer } from "@/components/quiz/quiz-player";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminQuiz } from "@/lib/quiz/queries";
import type { AttemptPayload } from "@/lib/quiz/schema";

export const metadata: Metadata = {
  title: "Vista previa | Cuestionario",
};

export default async function QuizPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const quiz = await getAdminQuiz(id);

  if (!quiz) {
    notFound();
  }

  // Same shape a participant receives: the correct flags are stripped here.
  const startedAt = quiz.opens_at;
  const payload: AttemptPayload = {
    answers: {},
    attempt_id: "preview",
    deadline_at: startedAt,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      max_chars: question.max_chars,
      options: question.options.map(({ id: optionId, label }) => ({ id: optionId, label })),
      points: question.points,
      prompt: question.prompt,
      type: question.type,
    })),
    quiz: { description: quiz.description, duration_seconds: quiz.duration_seconds, id: quiz.id, title: quiz.title },
    server_now: startedAt,
    started_at: startedAt,
    status: "started",
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
        Vista previa: así lo verá un participante. No se crea ningún intento.
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
      <QuizPlayer
        intro={{ duration_seconds: quiz.duration_seconds, max_points: 0, question_count: quiz.questions.length }}
        preview={payload}
        quizId={quiz.id}
      />
    </div>
  );
}
