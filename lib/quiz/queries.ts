import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { QuizResult } from "./schema";

export interface MyQuiz {
  attempt_status: string | null;
  closes_at: string;
  description: string;
  duration_seconds: number;
  id: string;
  max_points: number;
  opens_at: string;
  phase: "upcoming" | "active" | "ended";
  question_count: number;
  score: number | null;
  title: string;
}

export async function listMyQuizzes(): Promise<MyQuiz[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_quizzes");

  if (error) {
    throw new Error("No fue posible cargar los cuestionarios.");
  }

  return (data ?? []) as MyQuiz[];
}

export async function getQuizResult(quizId: string): Promise<QuizResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_quiz_result", { p_quiz_id: quizId });

  if (error) {
    throw new Error("No fue posible cargar el resultado.");
  }

  return (data as QuizResult | null) ?? null;
}

export interface PublicQuiz {
  closes_at: string;
  opens_at: string;
  phase: string;
  title: string;
}

export async function getPublicQuizzes(): Promise<PublicQuiz[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_quizzes");
  return (data ?? []) as PublicQuiz[];
}

export interface AdminQuizSummary {
  closes_at: string;
  id: string;
  locked_at: string | null;
  opens_at: string;
  status: string;
  title: string;
}

export async function getAdminQuizzes(): Promise<AdminQuizSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, title, status, opens_at, closes_at, locked_at")
    .order("opens_at", { ascending: false })
    .returns<AdminQuizSummary[]>();

  if (error) {
    throw new Error("No fue posible cargar los cuestionarios.");
  }

  return data ?? [];
}

export interface AdminQuizQuestion {
  explanation: string | null;
  id: string;
  max_chars: number | null;
  options: { correct: boolean; id: string; label: string }[];
  points: number;
  prompt: string;
  type: "multiple_choice" | "open_text";
}

export interface AdminQuiz {
  attempt_count: number;
  closes_at: string;
  description: string;
  duration_seconds: number;
  id: string;
  locked_at: string | null;
  opens_at: string;
  pending_reviews: number;
  questions: AdminQuizQuestion[];
  results_visibility: "none" | "score" | "score_and_solutions_after_close";
  shuffle_options: boolean;
  shuffle_questions: boolean;
  speed_bonus_enabled: boolean;
  speed_bonus_max: number;
  speed_bonus_min: number;
  speed_fast_threshold_seconds: number;
  speed_window_seconds: number;
  status: string;
  title: string;
}

export async function getAdminQuiz(quizId: string): Promise<AdminQuiz | null> {
  if (!/^[0-9a-f-]{36}$/.test(quizId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_quiz", { p_quiz_id: quizId });

  if (error) {
    throw new Error("No fue posible cargar el cuestionario.");
  }

  return (data as AdminQuiz | null) ?? null;
}

export interface ReviewItem {
  alias: string;
  attempt_id: string;
  max_points: number;
  passport_code: string;
  prompt: string;
  question_id: string;
  quiz_title: string;
  review_note: string | null;
  review_points: number | null;
  review_status: "pending" | "approved" | "partial" | "rejected";
  submitted_at: string | null;
  text_answer: string | null;
}

export async function getReviewQueue(): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_queue");

  if (error) {
    throw new Error("No fue posible cargar las revisiones.");
  }

  return (data ?? []) as ReviewItem[];
}
