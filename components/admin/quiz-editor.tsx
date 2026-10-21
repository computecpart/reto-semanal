"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";

import { FormStatus, fieldClassName, labelClassName } from "@/components/admin/admin-ui";
import { isoToSalvadorLocal } from "@/lib/campaign/schemas";
import { duplicateQuizAction, saveQuizAction, setQuizStatusAction } from "@/lib/quiz/actions";
import type { AdminQuiz } from "@/lib/quiz/queries";
import {
  RESULTS_VISIBILITIES,
  RESULTS_VISIBILITY_LABELS,
  speedBonus,
  type QuestionType,
  type ResultsVisibility,
} from "@/lib/quiz/schema";

interface EditorOption {
  correct: boolean;
  key: string;
  label: string;
}

interface EditorQuestion {
  explanation: string;
  key: string;
  maxChars: number;
  options: EditorOption[];
  points: number;
  prompt: string;
  type: QuestionType;
}

interface EditorState {
  closesAt: string;
  description: string;
  durationMinutes: number;
  opensAt: string;
  questions: EditorQuestion[];
  resultsVisibility: ResultsVisibility;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  speedEnabled: boolean;
  speedMax: number;
  speedMin: number;
  speedThreshold: number;
  speedWindow: number;
  title: string;
}

const button =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400";
const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

const key = () => globalThis.crypto.randomUUID();

function newQuestion(type: QuestionType): EditorQuestion {
  return {
    explanation: "",
    key: key(),
    maxChars: 500,
    options:
      type === "multiple_choice"
        ? [
            { correct: true, key: key(), label: "" },
            { correct: false, key: key(), label: "" },
          ]
        : [],
    points: 10,
    prompt: "",
    type,
  };
}

function fromQuiz(quiz: AdminQuiz | null): EditorState {
  const inOneDay = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  return {
    closesAt: isoToSalvadorLocal(quiz?.closes_at ?? inOneDay),
    description: quiz?.description ?? "",
    durationMinutes: Math.round((quiz?.duration_seconds ?? 300) / 60),
    opensAt: isoToSalvadorLocal(quiz?.opens_at ?? new Date().toISOString()),
    questions: quiz
      ? quiz.questions.map((question) => ({
          explanation: question.explanation ?? "",
          key: question.id,
          maxChars: question.max_chars ?? 500,
          options: question.options.map((option) => ({ correct: option.correct, key: option.id, label: option.label })),
          points: question.points,
          prompt: question.prompt,
          type: question.type,
        }))
      : [newQuestion("multiple_choice")],
    resultsVisibility: quiz?.results_visibility ?? "score_and_solutions_after_close",
    shuffleOptions: quiz?.shuffle_options ?? true,
    shuffleQuestions: quiz?.shuffle_questions ?? false,
    speedEnabled: quiz?.speed_bonus_enabled ?? false,
    speedMax: quiz?.speed_bonus_max ?? 20,
    speedMin: quiz?.speed_bonus_min ?? 0,
    speedThreshold: quiz?.speed_fast_threshold_seconds ?? 30,
    speedWindow: quiz?.speed_window_seconds ?? 180,
    title: quiz?.title ?? "",
  };
}

function toPayload(state: EditorState) {
  return {
    closes_at: state.closesAt,
    description: state.description,
    duration_seconds: Math.round(state.durationMinutes * 60),
    opens_at: state.opensAt,
    questions: state.questions.map((question) => ({
      explanation: question.explanation,
      max_chars: question.type === "open_text" ? question.maxChars : null,
      options: question.type === "multiple_choice" ? question.options.map(({ correct, label }) => ({ correct, label })) : [],
      points: question.points,
      prompt: question.prompt,
      type: question.type,
    })),
    results_visibility: state.resultsVisibility,
    shuffle_options: state.shuffleOptions,
    shuffle_questions: state.shuffleQuestions,
    speed_bonus_enabled: state.speedEnabled,
    speed_bonus_max: state.speedMax,
    speed_bonus_min: state.speedMin,
    speed_fast_threshold_seconds: state.speedThreshold,
    speed_window_seconds: state.speedWindow,
    title: state.title,
  };
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  disabled,
  max,
  min = 0,
  onChange,
  value,
}: {
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <input
      className={fieldClassName}
      disabled={disabled}
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value))}
      type="number"
      value={Number.isFinite(value) ? value : 0}
    />
  );
}

export function QuizEditor({ quiz }: { quiz: AdminQuiz | null }) {
  const router = useRouter();
  const [state, setState] = useState<EditorState>(() => fromQuiz(quiz));
  const [notice, setNotice] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = Boolean(quiz?.locked_at);
  const status = quiz?.status ?? "draft";
  const set = (patch: Partial<EditorState>) => setState((current) => ({ ...current, ...patch }));
  const setQuestion = (index: number, patch: Partial<EditorQuestion>) =>
    set({ questions: state.questions.map((question, i) => (i === index ? { ...question, ...patch } : question)) });

  function run<T>(action: () => Promise<{ message: string; status: string; data?: T }>, after?: (data: T) => void) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice({ message: result.message, tone: result.status === "success" ? "success" : "error" });

      if (result.status === "success") {
        after?.(result.data as T);
        router.refresh();
      }
    });
  }

  function save() {
    run<{ id: string }>(
      () => saveQuizAction(quiz?.id ?? null, toPayload(state)),
      (data) => {
        if (!quiz) {
          router.replace(`/admin/cuestionarios/${data.id}`);
        }
      },
    );
  }

  const mcTotal = state.questions.filter((q) => q.type === "multiple_choice").reduce((sum, q) => sum + q.points, 0);
  const bonusConfig = { max: state.speedMax, min: state.speedMin, threshold: state.speedThreshold, window: state.speedWindow };
  const previewTimes = [0, state.speedThreshold, Math.round((state.speedThreshold + state.speedWindow) / 2), state.speedWindow];

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <p className="text-sm text-slate-600">
          {quiz ? `Estado: ${status} · ${quiz.attempt_count} intentos` : "Nuevo cuestionario"}
          {locked ? " · Bloqueado: ya hay participaciones" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {quiz ? (
            <>
              <Link className={button} href={`/admin/cuestionarios/${quiz.id}/vista-previa`} target="_blank">
                Vista previa
              </Link>
              <button className={button} disabled={pending} onClick={() => run<{ id: string }>(() => duplicateQuizAction(quiz.id), (data) => router.push(`/admin/cuestionarios/${data.id}`))} type="button">
                Duplicar
              </button>
              {status === "draft" ? (
                <button className={button} disabled={pending} onClick={() => run(() => setQuizStatusAction(quiz.id, "scheduled"))} type="button">
                  Programar
                </button>
              ) : null}
              {status === "scheduled" && !locked ? (
                <button className={button} disabled={pending} onClick={() => run(() => setQuizStatusAction(quiz.id, "draft"))} type="button">
                  Volver a borrador
                </button>
              ) : null}
              {status === "scheduled" ? (
                <button
                  className={button}
                  disabled={pending}
                  onClick={() => window.confirm("¿Cerrar ahora? Los intentos en curso se calificarán con lo guardado.") && run(() => setQuizStatusAction(quiz.id, "closed"))}
                  type="button"
                >
                  Cerrar ahora
                </button>
              ) : null}
              {status === "draft" || status === "closed" ? (
                <button className={button} disabled={pending} onClick={() => window.confirm("¿Archivar?") && run(() => setQuizStatusAction(quiz.id, "archived"))} type="button">
                  Archivar
                </button>
              ) : null}
            </>
          ) : null}
          <button className={primary} disabled={pending || status === "archived"} onClick={save} type="button">
            {pending ? "Procesando…" : "Guardar"}
          </button>
        </div>
      </div>

      {notice ? <FormStatus tone={notice.tone}>{notice.message}</FormStatus> : null}
      {locked ? (
        <FormStatus tone="info">
          Ya hay participaciones: solo puedes cambiar título, descripción, cierre y visibilidad de resultados. Para cambiar
          preguntas, puntos o el bono, usa «Duplicar».
        </FormStatus>
      ) : null}

      <section className={card}>
        <h2 className="mb-4 text-lg font-bold">Datos y calendario</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título">
            <input className={fieldClassName} maxLength={120} onChange={(event) => set({ title: event.target.value })} value={state.title} />
          </Field>
          <Field label="Visibilidad de resultados">
            <select className={fieldClassName} onChange={(event) => set({ resultsVisibility: event.target.value as ResultsVisibility })} value={state.resultsVisibility}>
              {RESULTS_VISIBILITIES.map((value) => (
                <option key={value} value={value}>
                  {RESULTS_VISIBILITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descripción (opcional)">
            <textarea className={`${fieldClassName} min-h-20`} maxLength={2000} onChange={(event) => set({ description: event.target.value })} value={state.description} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Apertura (hora SV)">
            <input className={fieldClassName} disabled={locked} onChange={(event) => set({ opensAt: event.target.value })} type="datetime-local" value={state.opensAt} />
          </Field>
          <Field label="Cierre (hora SV)">
            <input className={fieldClassName} onChange={(event) => set({ closesAt: event.target.value })} type="datetime-local" value={state.closesAt} />
          </Field>
          <Field label="Duración (minutos)">
            <NumberInput disabled={locked} max={120} min={1} onChange={(durationMinutes) => set({ durationMinutes })} value={state.durationMinutes} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input checked={state.shuffleQuestions} disabled={locked} onChange={(event) => set({ shuffleQuestions: event.target.checked })} type="checkbox" />
            Aleatorizar preguntas
          </label>
          <label className="flex items-center gap-2">
            <input checked={state.shuffleOptions} disabled={locked} onChange={(event) => set({ shuffleOptions: event.target.checked })} type="checkbox" />
            Aleatorizar opciones
          </label>
        </div>
      </section>

      <section className={card}>
        <label className="flex items-center gap-2 text-lg font-bold">
          <input checked={state.speedEnabled} disabled={locked} onChange={(event) => set({ speedEnabled: event.target.checked })} type="checkbox" />
          Bono de velocidad
        </label>
        <p className="mt-1 text-sm text-slate-600">
          Con t = segundos desde que empieza hasta que envía: si t ≤ umbral, recibe el máximo; si t ≥ ventana, el mínimo; en
          medio baja en línea recta. El bono se multiplica por el porcentaje de puntos de opción múltiple acertados (enviar en
          blanco y rápido no da bono) y se redondea hacia abajo. Solo aplica si se envía antes del plazo.
        </p>
        {state.speedEnabled ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <Field label="Bono máximo">
                <NumberInput disabled={locked} onChange={(speedMax) => set({ speedMax })} value={state.speedMax} />
              </Field>
              <Field label="Bono mínimo">
                <NumberInput disabled={locked} onChange={(speedMin) => set({ speedMin })} value={state.speedMin} />
              </Field>
              <Field label="Umbral rápido (s)">
                <NumberInput disabled={locked} onChange={(speedThreshold) => set({ speedThreshold })} value={state.speedThreshold} />
              </Field>
              <Field label="Ventana total (s)">
                <NumberInput disabled={locked} min={1} onChange={(speedWindow) => set({ speedWindow })} value={state.speedWindow} />
              </Field>
            </div>
            {state.speedWindow > state.speedThreshold && state.speedMin <= state.speedMax ? (
              <table className="mt-4 w-full max-w-lg text-sm">
                <caption className="mb-2 text-left font-semibold">Vista previa del bono</caption>
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1 text-left">Tiempo</th>
                    <th className="py-1 text-right">100 % acierto</th>
                    <th className="py-1 text-right">50 % acierto</th>
                  </tr>
                </thead>
                <tbody>
                  {previewTimes.map((seconds, index) => (
                    <tr className="border-t border-slate-100" key={`${seconds}-${index}`}>
                      <td className="py-1">{seconds} s</td>
                      <td className="py-1 text-right">{mcTotal > 0 ? speedBonus(seconds, bonusConfig, 1) : 0}</td>
                      <td className="py-1 text-right">{mcTotal > 0 ? speedBonus(seconds, bonusConfig, 0.5) : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-red-700">Revisa: la ventana debe superar al umbral y el mínimo no puede superar al máximo.</p>
            )}
          </>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            Preguntas ({state.questions.length}) · {state.questions.reduce((sum, q) => sum + q.points, 0)} pts
          </h2>
          {!locked ? (
            <div className="flex gap-2">
              <button className={button} onClick={() => set({ questions: [...state.questions, newQuestion("multiple_choice")] })} type="button">
                + Opción múltiple
              </button>
              <button className={button} onClick={() => set({ questions: [...state.questions, newQuestion("open_text")] })} type="button">
                + Respuesta abierta
              </button>
            </div>
          ) : null}
        </div>

        {state.questions.map((question, index) => (
          <fieldset className={card} disabled={locked} key={question.key}>
            <legend className="sr-only">Pregunta {index + 1}</legend>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {index + 1}. {question.type === "multiple_choice" ? "Opción múltiple" : "Respuesta abierta (revisión manual)"}
              </p>
              <div className="flex gap-1">
                <button aria-label="Subir" className={button} disabled={index === 0} onClick={() => {
                  const questions = [...state.questions];
                  [questions[index - 1], questions[index]] = [questions[index]!, questions[index - 1]!];
                  set({ questions });
                }} type="button">↑</button>
                <button aria-label="Bajar" className={button} disabled={index === state.questions.length - 1} onClick={() => {
                  const questions = [...state.questions];
                  [questions[index + 1], questions[index]] = [questions[index]!, questions[index + 1]!];
                  set({ questions });
                }} type="button">↓</button>
                <button className={button} onClick={() => set({ questions: state.questions.filter((_, i) => i !== index) })} type="button">
                  Eliminar
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Enunciado">
                <textarea className={`${fieldClassName} min-h-20`} maxLength={1000} onChange={(event) => setQuestion(index, { prompt: event.target.value })} value={question.prompt} />
              </Field>
              <Field label="Puntos">
                <NumberInput max={10000} onChange={(points) => setQuestion(index, { points })} value={question.points} />
              </Field>
            </div>

            {question.type === "multiple_choice" ? (
              <div className="mt-4 space-y-2">
                <p className={labelClassName}>Opciones (marca la correcta)</p>
                {question.options.map((option, optionIndex) => (
                  <div className="flex items-center gap-2" key={option.key}>
                    <input
                      aria-label={`Opción ${optionIndex + 1} es la correcta`}
                      checked={option.correct}
                      name={`correct-${question.key}`}
                      onChange={() => setQuestion(index, { options: question.options.map((o, i) => ({ ...o, correct: i === optionIndex })) })}
                      type="radio"
                    />
                    <input
                      aria-label={`Texto de la opción ${optionIndex + 1}`}
                      className={`${fieldClassName} mt-0`}
                      maxLength={300}
                      onChange={(event) => setQuestion(index, { options: question.options.map((o, i) => (i === optionIndex ? { ...o, label: event.target.value } : o)) })}
                      value={option.label}
                    />
                    <button className={button} disabled={question.options.length <= 2} onClick={() => setQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })} type="button">
                      Quitar
                    </button>
                  </div>
                ))}
                <button className={button} disabled={question.options.length >= 10} onClick={() => setQuestion(index, { options: [...question.options, { correct: false, key: key(), label: "" }] })} type="button">
                  + Opción
                </button>
              </div>
            ) : (
              <div className="mt-4 max-w-48">
                <Field label="Máximo de caracteres">
                  <NumberInput max={2000} min={10} onChange={(maxChars) => setQuestion(index, { maxChars })} value={question.maxChars} />
                </Field>
              </div>
            )}

            <div className="mt-4">
              <Field label="Explicación (se muestra con las soluciones)">
                <input className={fieldClassName} maxLength={1000} onChange={(event) => setQuestion(index, { explanation: event.target.value })} value={question.explanation} />
              </Field>
            </div>
          </fieldset>
        ))}
      </section>
    </div>
  );
}
