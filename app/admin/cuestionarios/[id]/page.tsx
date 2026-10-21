import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuizEditor } from "@/components/admin/quiz-editor";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminQuiz } from "@/lib/quiz/queries";

export const metadata: Metadata = {
  title: "Editar cuestionario | Administración",
};

export default async function AdminQuizPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const quiz = id === "nuevo" ? null : await getAdminQuiz(id);

  if (id !== "nuevo" && !quiz) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link className="text-sm font-semibold text-sky-800 hover:underline" href="/admin/cuestionarios">
        ← Cuestionarios
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{quiz ? quiz.title : "Nuevo cuestionario"}</h1>
      {quiz && quiz.pending_reviews > 0 ? (
        <p className="text-sm">
          <Link className="font-semibold text-amber-800 underline" href="/admin/revisiones">
            {quiz.pending_reviews} respuestas abiertas pendientes de revisión
          </Link>
        </p>
      ) : null}
      <QuizEditor key={quiz?.id ?? "nuevo"} quiz={quiz} />
    </div>
  );
}
