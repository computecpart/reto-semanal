"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { FormStatus, SubmitButton, checkboxClassName, fieldClassName } from "@/components/auth/form-ui";
import { saveAnswerAction, startQuizAction, submitQuizAction } from "@/lib/quiz/actions";
import type { AttemptPayload, QuizResult } from "@/lib/quiz/schema";

import { QuizResultView } from "./quiz-result";

type Answers = AttemptPayload["answers"];
type SaveState = "idle" | "saving" | "saved" | "error";

const TEXT_SAVE_DELAY_MS = 800;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Runs one attempt. The countdown is cosmetic: PostgreSQL rejects late saves
 * and scores with its own clock, so a tampered timer gains nothing.
 */
export function QuizPlayer({
  intro,
  preview,
  quizId,
}: {
  intro: { duration_seconds: number; max_points: number; question_count: number };
  preview?: AttemptPayload;
  quizId: string;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptPayload | null>(preview ?? null);
  const [answers, setAnswers] = useState<Answers>(preview?.answers ?? {});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [clockOffset, setClockOffset] = useState(0);
  const textTimers = useRef(new Map<string, number>());
  const pendingTexts = useRef(new Map<string, string>());
  const submitted = useRef(false);

  const deadline = attempt ? new Date(attempt.deadline_at).getTime() : 0;
  const remaining = attempt ? Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000)) : 0;

  const submit = useCallback(() => {
    if (!attempt || submitted.current || preview) {
      return;
    }

    submitted.current = true;
    startTransition(async () => {
      // Flush debounced open answers so the last keystrokes are scored.
      for (const [questionId, text] of pendingTexts.current) {
        window.clearTimeout(textTimers.current.get(questionId));
        await saveAnswerAction(attempt.attempt_id, questionId, null, text);
      }
      pendingTexts.current.clear();

      const response = await submitQuizAction(attempt.attempt_id);

      if (response.status === "success") {
        setResult(response.data);
        router.refresh();
      } else {
        submitted.current = false;
        setError(response.message);
      }
    });
  }, [attempt, preview, router]);

  useEffect(() => {
    if (!attempt || result) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [attempt, result]);

  // Time is up on the client: submit what was saved. The server decides
  // whether it still counts as on time.
  useEffect(() => {
    if (attempt && !result && !preview && remaining === 0) {
      const timer = window.setTimeout(submit, 0);
      return () => window.clearTimeout(timer);
    }
  }, [attempt, preview, remaining, result, submit]);

  function begin() {
    setError("");
    startTransition(async () => {
      const response = await startQuizAction(quizId);

      if (response.status === "success") {
        setClockOffset(new Date(response.data.server_now).getTime() - Date.now());
        setAttempt(response.data);
        setAnswers(response.data.answers ?? {});
        setNow(Date.now());
      } else {
        setError(response.message);
      }
    });
  }

  function persist(questionId: string, optionId: string | null, text: string | null) {
    if (!attempt || preview) {
      return;
    }

    if (text !== null) {
      pendingTexts.current.delete(questionId);
    }

    setSaveState("saving");
    void saveAnswerAction(attempt.attempt_id, questionId, optionId, text).then((response) => {
      setSaveState(response.status === "success" ? "saved" : "error");

      if (response.status === "error") {
        setError(response.message);
      }
    });
  }

  function choose(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: { option_id: optionId, text: null } }));
    persist(questionId, optionId, null);
  }

  function write(questionId: string, text: string) {
    setAnswers((current) => ({ ...current, [questionId]: { option_id: null, text } }));
    pendingTexts.current.set(questionId, text);
    window.clearTimeout(textTimers.current.get(questionId));
    textTimers.current.set(
      questionId,
      window.setTimeout(() => persist(questionId, null, text), TEXT_SAVE_DELAY_MS),
    );
  }

  if (result) {
    return <QuizResultView result={result} />;
  }

  if (!attempt) {
    return (
      <div className="space-y-6">
        <FormStatus>{error}</FormStatus>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Preguntas", String(intro.question_count)],
            ["Tiempo", formatClock(intro.duration_seconds)],
            ["Puntos posibles", String(intro.max_points)],
          ].map(([label, value]) => (
            <div className="pixel-frame-sm bg-white p-4" key={label}>
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 font-display text-3xl">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Tienes un solo intento puntuable. El tiempo corre desde que pulsas «Comenzar».</li>
          <li>Tus respuestas se guardan solas; si se corta la conexión, vuelve a entrar para continuar.</li>
          <li>Las respuestas incorrectas no restan puntos.</li>
        </ul>
        <SubmitButton className="sm:w-auto" onClick={begin} pending={pending} pendingLabel="Preparando…" type="button">
          Comenzar
        </SubmitButton>
      </div>
    );
  }

  const answeredCount = attempt.questions.filter((question) => {
    const answer = answers[question.id];
    return question.type === "multiple_choice" ? Boolean(answer?.option_id) : Boolean(answer?.text?.trim());
  }).length;

  return (
    <div className="space-y-6">
      <div className="pixel-frame-sm sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
        <p className="text-sm font-bold">
          {preview ? "Vista previa (no se guarda)" : `${answeredCount} de ${attempt.questions.length} respondidas`}
          {!preview && saveState === "saving" ? " · Guardando…" : null}
          {!preview && saveState === "saved" ? " · Guardado" : null}
        </p>
        <p
          aria-live="polite"
          className={`font-display text-2xl ${remaining <= 30 && !preview ? "text-red-700" : ""}`}
          role="timer"
        >
          {formatClock(preview ? attempt.quiz.duration_seconds : remaining)}
        </p>
      </div>

      <FormStatus>{error}</FormStatus>

      <ol className="space-y-6">
        {attempt.questions.map((question, index) => (
          <li className="pixel-frame bg-white p-5 sm:p-6" key={question.id}>
            <fieldset>
              <legend className="w-full">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Pregunta {index + 1} · {question.points} pts
                </span>
                <span className="mt-2 block whitespace-pre-line text-lg font-bold">{question.prompt}</span>
              </legend>

              {question.type === "multiple_choice" ? (
                <div className="mt-4 grid gap-3">
                  {question.options.map((option) => (
                    <label
                      className="flex cursor-pointer items-start gap-3 border-2 border-slate-300 p-3 has-[:checked]:border-[var(--color-ink)] has-[:checked]:bg-[var(--accent-soft)]"
                      key={option.id}
                    >
                      <input
                        checked={answers[question.id]?.option_id === option.id}
                        className={checkboxClassName}
                        disabled={remaining === 0 && !preview}
                        name={`question-${question.id}`}
                        onChange={() => choose(question.id, option.id)}
                        type="radio"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <textarea
                    aria-label={`Respuesta a la pregunta ${index + 1}`}
                    className={`${fieldClassName} min-h-32`}
                    disabled={remaining === 0 && !preview}
                    maxLength={question.max_chars ?? 2000}
                    onChange={(event) => write(question.id, event.target.value)}
                    value={answers[question.id]?.text ?? ""}
                  />
                  <p className="mt-1 text-right text-xs text-slate-500">
                    {(answers[question.id]?.text ?? "").length}/{question.max_chars}
                  </p>
                </div>
              )}
            </fieldset>
          </li>
        ))}
      </ol>

      {!preview ? (
        <SubmitButton
          className="sm:w-auto"
          onClick={() => {
            if (window.confirm("¿Enviar tus respuestas? No podrás cambiarlas después.")) {
              submit();
            }
          }}
          pending={pending}
          pendingLabel="Enviando…"
          type="button"
        >
          Enviar respuestas
        </SubmitButton>
      ) : null}
    </div>
  );
}
