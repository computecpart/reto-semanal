import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { quizEditorSchema, speedBonus } from "@/lib/quiz/schema";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261022000000_quizzes.sql"), "utf8");
const config = { max: 50, min: 10, threshold: 30, window: 120 };

function body(name: string): string {
  const start = sql.indexOf(`function ${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("$$;", start));
}

describe("bono de velocidad", () => {
  it("da el máximo hasta el umbral y el mínimo desde la ventana", () => {
    expect(speedBonus(0, config, 1)).toBe(50);
    expect(speedBonus(30, config, 1)).toBe(50);
    expect(speedBonus(120, config, 1)).toBe(10);
    expect(speedBonus(500, config, 1)).toBe(10);
  });

  it("interpola linealmente y redondea hacia abajo", () => {
    expect(speedBonus(75, config, 1)).toBe(30);
    expect(speedBonus(31, config, 1)).toBe(49);
  });

  it("se multiplica por el acierto: en blanco no da bono", () => {
    expect(speedBonus(0, config, 0)).toBe(0);
    expect(speedBonus(0, config, 0.5)).toBe(25);
    expect(speedBonus(0, config, 2)).toBe(50);
  });

  it("la fórmula SQL usa los mismos límites", () => {
    const sqlBonus = body("private.speed_bonus");

    expect(sqlBonus).toContain("when p_elapsed_seconds <= p_threshold then p_max");
    expect(sqlBonus).toContain("when p_elapsed_seconds >= p_window then p_min");
    expect(sqlBonus).toContain("pg_catalog.floor(");
  });
});

describe("editor de cuestionarios", () => {
  const base = {
    closes_at: "2026-10-24T12:00",
    description: "",
    duration_seconds: 300,
    opens_at: "2026-10-24T10:00",
    questions: [
      {
        explanation: "",
        max_chars: null,
        options: [
          { correct: true, label: "A" },
          { correct: false, label: "B" },
        ],
        points: 10,
        prompt: "¿?",
        type: "multiple_choice" as const,
      },
    ],
    results_visibility: "score" as const,
    shuffle_options: true,
    shuffle_questions: false,
    speed_bonus_enabled: true,
    speed_bonus_max: 20,
    speed_bonus_min: 0,
    speed_fast_threshold_seconds: 30,
    speed_window_seconds: 180,
    title: "Trivia 1",
  };

  it("acepta un cuestionario válido y convierte las fechas a UTC", () => {
    const parsed = quizEditorSchema.parse(base);
    expect(parsed.opens_at).toBe("2026-10-24T16:00:00.000Z");
  });

  it("rechaza dos respuestas correctas, cierre previo y ventana inválida", () => {
    const twoCorrect = { ...base, questions: [{ ...base.questions[0]!, options: base.questions[0]!.options.map((o) => ({ ...o, correct: true })) }] };

    expect(quizEditorSchema.safeParse(twoCorrect).success).toBe(false);
    expect(quizEditorSchema.safeParse({ ...base, closes_at: "2026-10-24T09:00" }).success).toBe(false);
    expect(quizEditorSchema.safeParse({ ...base, speed_window_seconds: 10 }).success).toBe(false);
  });
});

describe("seguridad de los cuestionarios", () => {
  it("las respuestas correctas viven solo en el esquema privado", () => {
    expect(sql).toContain("create table private.quiz_answer_keys");
    expect(sql).not.toMatch(/create table public\.\w+ \([^;]*correct_option/);
    expect(sql).toContain("revoke all on table private.quiz_answer_keys from public, anon, authenticated;");
  });

  it("los clientes no leen preguntas, opciones ni respuestas directamente", () => {
    for (const table of ["quiz_questions", "quiz_options", "quiz_answers"]) {
      expect(sql).not.toMatch(new RegExp(`grant [^;]* on table public\\.${table}`));
    }
  });

  it("ningún RPC de participante devuelve datos de corrección", () => {
    for (const name of ["private.attempt_payload", "public.list_my_quizzes", "public.start_quiz_attempt", "public.get_public_quizzes"]) {
      const fn = body(name);
      expect(fn, name).not.toContain("quiz_answer_keys");
      expect(fn, name).not.toContain("correct_option_id");
      expect(fn, name).not.toContain("explanation");
    }
  });

  it("las soluciones solo se revelan después del cierre", () => {
    expect(body("public.get_quiz_result")).toContain("pg_catalog.statement_timestamp() >= v_quiz.closes_at");
  });

  it("un intento por participante, bloqueo por trigger y envío idempotente", () => {
    expect(sql).toContain("unique (quiz_id, user_id)");
    expect(sql).toMatch(/create trigger quiz_questions_guard_locked\s+before insert or update or delete/);
    expect(sql).toMatch(/create trigger quiz_options_guard_locked\s+before insert or update or delete/);
    expect(sql).toMatch(/create trigger quiz_answer_keys_guard_locked\s+before insert or update or delete/);
    expect(body("private.finalize_attempt")).toContain("v_attempt.status <> 'started'::public.quiz_attempt_status");
  });

  it("los puntos de trivias pasan siempre por award_points y el plazo lo fija el servidor", () => {
    expect(body("private.finalize_attempt")).toContain("private.award_points(");
    expect(body("public.admin_review_answer")).toContain("private.award_points(");
    expect(sql).not.toMatch(/insert into public\.point_events/);
    expect(body("public.save_quiz_answer")).toContain("pg_catalog.statement_timestamp() >= least(v_attempt.deadline_at, v_closes_at)");
  });
});
