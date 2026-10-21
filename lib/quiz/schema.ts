import { z } from "zod";

import { salvadorLocalToIso } from "@/lib/campaign/schemas";

export const QUESTION_TYPES = ["multiple_choice", "open_text"] as const;
export const RESULTS_VISIBILITIES = ["none", "score", "score_and_solutions_after_close"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type ResultsVisibility = (typeof RESULTS_VISIBILITIES)[number];

export const RESULTS_VISIBILITY_LABELS: Readonly<Record<ResultsVisibility, string>> = {
  none: "No mostrar resultados",
  score: "Mostrar solo el puntaje",
  score_and_solutions_after_close: "Puntaje y soluciones después del cierre",
};

export const QUIZ_STATUS_LABELS: Readonly<Record<string, string>> = {
  archived: "Archivado",
  closed: "Cerrado",
  draft: "Borrador",
  scheduled: "Programado",
};

export const ATTEMPT_STATUS_LABELS: Readonly<Record<string, string>> = {
  expired: "Tiempo agotado",
  invalidated: "Sin puntuación",
  scored: "Calificado",
  started: "En curso",
  submitted: "Enviado",
  submitted_pending_review: "En revisión",
};

/**
 * Mirror of private.speed_bonus (SQL is authoritative). Used for the admin
 * preview: linear between threshold and window, scaled by MC accuracy.
 */
export function speedBonus(
  elapsedSeconds: number,
  config: { max: number; min: number; threshold: number; window: number },
  accuracy: number,
): number {
  const { max, min, threshold, window } = config;
  const base =
    elapsedSeconds <= threshold
      ? max
      : elapsedSeconds >= window
        ? min
        : max - ((max - min) * (elapsedSeconds - threshold)) / (window - threshold);

  return Math.max(0, Math.floor(base * Math.min(Math.max(accuracy, 0), 1)));
}

const text = (max: number, min = 0, message = "Este campo es obligatorio.") =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`).min(min, min > 0 ? message : undefined);

const localDate = z.string().transform((value, context) => {
  const iso = salvadorLocalToIso(value.trim());

  if (!iso) {
    context.addIssue({ code: "custom", message: "Fecha y hora no válidas." });
    return z.NEVER;
  }

  return iso;
});

export const quizOptionSchema = z.object({
  correct: z.boolean(),
  label: text(300, 1, "Escribe el texto de la opción."),
});

export const quizQuestionSchema = z
  .object({
    explanation: text(1000),
    max_chars: z.number().int().min(10).max(2000).nullable(),
    options: z.array(quizOptionSchema).max(10, "Máximo 10 opciones."),
    points: z.number().int().min(0, "Mínimo 0.").max(10000, "Máximo 10 000."),
    prompt: text(1000, 1, "Escribe el enunciado."),
    type: z.enum(QUESTION_TYPES),
  })
  .superRefine((question, context) => {
    if (question.type === "multiple_choice" && question.options.filter((option) => option.correct).length > 1) {
      context.addIssue({ code: "custom", message: "Marca solo una respuesta correcta.", path: ["options"] });
    }

    if (question.type === "open_text" && question.max_chars === null) {
      context.addIssue({ code: "custom", message: "Define el máximo de caracteres.", path: ["max_chars"] });
    }
  });

export const quizEditorSchema = z
  .object({
    closes_at: localDate,
    description: text(2000),
    duration_seconds: z.number().int().min(30, "Mínimo 30 segundos.").max(7200, "Máximo 2 horas."),
    opens_at: localDate,
    questions: z.array(quizQuestionSchema).max(100, "Máximo 100 preguntas."),
    results_visibility: z.enum(RESULTS_VISIBILITIES),
    shuffle_options: z.boolean(),
    shuffle_questions: z.boolean(),
    speed_bonus_enabled: z.boolean(),
    speed_bonus_max: z.number().int().min(0).max(10000),
    speed_bonus_min: z.number().int().min(0).max(10000),
    speed_fast_threshold_seconds: z.number().int().min(0),
    speed_window_seconds: z.number().int().min(1),
    title: text(120, 3, "Mínimo 3 caracteres."),
  })
  .superRefine((quiz, context) => {
    if (quiz.closes_at <= quiz.opens_at) {
      context.addIssue({ code: "custom", message: "El cierre debe ser posterior a la apertura.", path: ["closes_at"] });
    }

    if (quiz.speed_bonus_min > quiz.speed_bonus_max) {
      context.addIssue({ code: "custom", message: "El bono mínimo no puede superar al máximo.", path: ["speed_bonus_min"] });
    }

    if (quiz.speed_window_seconds <= quiz.speed_fast_threshold_seconds) {
      context.addIssue({
        code: "custom",
        message: "La ventana debe ser mayor que el umbral rápido.",
        path: ["speed_window_seconds"],
      });
    }
  });

export type QuizEditorInput = z.input<typeof quizEditorSchema>;
export type QuizEditorPayload = z.output<typeof quizEditorSchema>;

/** Shapes returned by the participant RPCs (never contain correction data). */
export interface AttemptQuestion {
  id: string;
  max_chars: number | null;
  options: { id: string; label: string }[];
  points: number;
  prompt: string;
  type: QuestionType;
}

export interface AttemptPayload {
  answers: Record<string, { option_id: string | null; text: string | null }>;
  attempt_id: string;
  deadline_at: string;
  questions: AttemptQuestion[];
  quiz: { description: string; duration_seconds: number; id: string; title: string };
  server_now: string;
  started_at: string;
  status: string;
}

export interface QuizResult {
  auto_score: number | null;
  bonus_score: number | null;
  closes_at: string;
  correct_count: number | null;
  finalized_late: boolean;
  review_score: number | null;
  score: number | null;
  solutions:
    | {
        correct_option: string | null;
        explanation: string;
        is_correct: boolean;
        points: number;
        prompt: string;
        review_points: number | null;
        review_status: string | null;
        type: QuestionType;
        your_option: string | null;
        your_text: string | null;
      }[]
    | null;
  solutions_available: boolean;
  status: string;
}
