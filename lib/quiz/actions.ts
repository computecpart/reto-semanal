"use server";

import { revalidatePath } from "next/cache";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import { getQuizRpcErrorMessage } from "./rpc-errors";
import { quizEditorSchema, type AttemptPayload, type QuizResult } from "./schema";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type QuizActionResult<T = undefined> =
  | { data: T; message: string; status: "success" }
  | { message: string; status: "error" };

function fail(message: string): { message: string; status: "error" } {
  return { message, status: "error" };
}

async function isAdmin(): Promise<boolean> {
  const context = await getAuthContext();
  return Boolean(context && isAdministrativeRole(context.role));
}

function revalidateQuizzes() {
  revalidatePath("/");
  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Administration (every RPC re-checks the role with private.require_role)
// ---------------------------------------------------------------------------

export async function saveQuizAction(
  quizId: string | null,
  input: unknown,
): Promise<QuizActionResult<{ id: string }>> {
  if ((quizId !== null && !UUID_PATTERN.test(quizId)) || !(await isAdmin())) {
    return fail("No tienes permiso para esta operación.");
  }

  const parsed = quizEditorSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const questionIndex = issue?.path[0] === "questions" ? issue.path[1] : undefined;
    const where = typeof questionIndex === "number" ? ` (pregunta ${questionIndex + 1})` : "";
    return fail(`${issue?.message ?? "Revisa el cuestionario."}${where}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_quiz", { p_payload: parsed.data, p_quiz_id: quizId });

  if (error || typeof data !== "string") {
    return fail(getQuizRpcErrorMessage(error ?? {}));
  }

  revalidateQuizzes();
  return { data: { id: data }, message: "Cuestionario guardado.", status: "success" };
}

export async function setQuizStatusAction(quizId: string, status: string): Promise<QuizActionResult> {
  if (!UUID_PATTERN.test(quizId) || !["draft", "scheduled", "closed", "archived"].includes(status) || !(await isAdmin())) {
    return fail("No tienes permiso para esta operación.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_quiz_status", { p_quiz_id: quizId, p_status: status });

  if (error) {
    return fail(getQuizRpcErrorMessage(error));
  }

  revalidateQuizzes();
  return { data: undefined, message: "Estado actualizado.", status: "success" };
}

export async function duplicateQuizAction(quizId: string): Promise<QuizActionResult<{ id: string }>> {
  if (!UUID_PATTERN.test(quizId) || !(await isAdmin())) {
    return fail("No tienes permiso para esta operación.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_duplicate_quiz", { p_quiz_id: quizId });

  if (error || typeof data !== "string") {
    return fail(getQuizRpcErrorMessage(error ?? {}));
  }

  revalidateQuizzes();
  return { data: { id: data }, message: "Copia creada en borrador.", status: "success" };
}

export async function reviewAnswerAction(
  attemptId: string,
  questionId: string,
  points: number,
  note: string,
): Promise<QuizActionResult> {
  if (
    !UUID_PATTERN.test(attemptId) ||
    !UUID_PATTERN.test(questionId) ||
    !Number.isInteger(points) ||
    points < 0 ||
    note.length > 500 ||
    !(await isAdmin())
  ) {
    return fail("Datos de revisión no válidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_answer", {
    p_attempt_id: attemptId,
    p_note: note,
    p_points: points,
    p_question_id: questionId,
  });

  if (error) {
    return fail(getQuizRpcErrorMessage(error));
  }

  revalidateQuizzes();
  return { data: undefined, message: "Revisión guardada.", status: "success" };
}

// ---------------------------------------------------------------------------
// Participant (the server and PostgreSQL decide time and scoring)
// ---------------------------------------------------------------------------

export async function startQuizAction(quizId: string): Promise<QuizActionResult<AttemptPayload>> {
  if (!UUID_PATTERN.test(quizId) || !(await getAuthContext())) {
    return fail("Tu sesión expiró. Vuelve a iniciar sesión.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });

  if (error || !data) {
    return fail(getQuizRpcErrorMessage(error ?? {}));
  }

  return { data: data as AttemptPayload, message: "", status: "success" };
}

export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  optionId: string | null,
  text: string | null,
): Promise<QuizActionResult> {
  if (
    !UUID_PATTERN.test(attemptId) ||
    !UUID_PATTERN.test(questionId) ||
    (optionId !== null && !UUID_PATTERN.test(optionId)) ||
    (text !== null && text.length > 2000)
  ) {
    return fail("Respuesta no válida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_quiz_answer", {
    p_attempt_id: attemptId,
    p_option_id: optionId,
    p_question_id: questionId,
    p_text: text,
  });

  return error ? fail(getQuizRpcErrorMessage(error)) : { data: undefined, message: "", status: "success" };
}

export async function submitQuizAction(attemptId: string): Promise<QuizActionResult<QuizResult>> {
  if (!UUID_PATTERN.test(attemptId)) {
    return fail("Intento no válido.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });

  if (error || !data) {
    return fail(getQuizRpcErrorMessage(error ?? {}));
  }

  revalidatePath("/app", "layout");
  return { data: data as QuizResult, message: "Cuestionario enviado.", status: "success" };
}
