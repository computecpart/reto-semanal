// Runs only against LOCAL Supabase seeded with `npm run seed:demo`
// (`npm run test:db`). Never points at production.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const env: Record<string, string> = {};

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.demo.local"), "utf8").split(/\r?\n/)) {
    const match = /^([A-Z_0-9]+)=(.*)$/.exec(line);

    if (match) {
      env[match[1]!] = match[2]!;
    }
  }
} catch {
  // No local demo environment: the suite is skipped below.
}

const isLocal = env.SUPABASE_ENVIRONMENT === "local" && /^http:\/\/(127\.0\.0\.1|localhost):/.test(env.SUPABASE_URL ?? "");
const run = process.env.RUN_DB_TESTS === "1" && isLocal ? describe : describe.skip;

function account(name: string) {
  const value = env[`DEMO_${name}`] ?? "";
  const separator = value.indexOf(":");
  return { email: value.slice(0, separator), password: value.slice(separator + 1) };
}

async function login(name: string): Promise<SupabaseClient> {
  const client = createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword(account(name));

  if (error) {
    throw new Error(`login ${name}: ${error.message}`);
  }

  return client;
}

async function call<T>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);

  if (error) {
    throw new Error(`${fn}: ${error.message}`);
  }

  return data as T;
}

const iso = (hours: number) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

run("integración con PostgreSQL local", () => {
  let boss: SupabaseClient;

  beforeAll(async () => {
    boss = await login("CAPITANA_DEMO");
  });

  it("el ranking coincide exactamente con la suma del ledger", async () => {
    const campaigns = await boss.from("campaigns").select("id").eq("status", "published").single();
    const campaignId = campaigns.data!.id as string;
    const standings = await call<{ points: number; user_id: string }[]>(boss, "admin_get_standings", { p_campaign_id: campaignId });
    const events = await boss.from("point_events").select("user_id, amount").eq("campaign_id", campaignId);
    const sums = new Map<string, number>();

    for (const event of events.data ?? []) {
      sums.set(event.user_id, (sums.get(event.user_id) ?? 0) + event.amount);
    }

    expect(standings.length).toBeGreaterThan(0);

    for (const row of standings) {
      expect(Number(row.points)).toBe(sums.get(row.user_id) ?? 0);
    }
  });

  it("canjes simultáneos de la misma misión dan una sola redención y un solo evento", async () => {
    const rewardId = await call<string>(boss, "admin_save_reward", {
      p_description: "",
      p_enabled: true,
      p_expires_at: iso(2),
      p_name: `Concurrencia ${Date.now()}`,
      p_points: 7,
      p_reward_id: null,
      p_starts_at: iso(-1),
    });
    const { code } = await call<{ code: string }>(boss, "admin_get_reward", { p_reward_id: rewardId });
    const player = await login("JUGADOR2");
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => call<{ ok: boolean }>(player, "redeem_reward", { p_channel: i % 2 ? "qr" : "manual", p_code: code })),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const reward = await call<{ redemptions: unknown[] }>(boss, "admin_get_reward", { p_reward_id: rewardId });
    expect(reward.redemptions).toHaveLength(1);
    const events = await boss.from("point_events").select("id").eq("source_id", rewardId);
    expect(events.data).toHaveLength(1);
  });

  it("envíos simultáneos de una trivia puntúan una sola vez y no filtran respuestas", async () => {
    const quizId = await call<string>(boss, "admin_save_quiz", {
      p_payload: {
        closes_at: iso(2),
        description: "",
        duration_seconds: 300,
        opens_at: iso(-1),
        questions: [{ explanation: "secreto", max_chars: null, options: [{ correct: true, label: "Sí" }, { correct: false, label: "No" }], points: 10, prompt: "¿Ok?", type: "multiple_choice" }],
        results_visibility: "score",
        shuffle_options: false,
        shuffle_questions: false,
        speed_bonus_enabled: false,
        speed_bonus_max: 0,
        speed_bonus_min: 0,
        speed_fast_threshold_seconds: 0,
        speed_window_seconds: 60,
        title: `Concurrencia ${Date.now()}`,
      },
      p_quiz_id: null,
    });
    await call(boss, "admin_set_quiz_status", { p_quiz_id: quizId, p_status: "scheduled" });
    const player = await login("JUGADOR3");
    const attempt = await call<{ attempt_id: string; questions: { id: string; options: { id: string; label: string }[] }[] }>(player, "start_quiz_attempt", { p_quiz_id: quizId });

    expect(JSON.stringify(attempt)).not.toMatch(/correct|secreto/);

    const question = attempt.questions[0]!;
    const yes = question.options.find((option) => option.label === "Sí")!;
    await call(player, "save_quiz_answer", { p_attempt_id: attempt.attempt_id, p_option_id: yes.id, p_question_id: question.id, p_text: null });
    const results = await Promise.all(Array.from({ length: 6 }, () => call<{ score: number }>(player, "submit_quiz_attempt", { p_attempt_id: attempt.attempt_id })));

    expect(new Set(results.map((result) => result.score))).toEqual(new Set([10]));
    const events = await boss.from("point_events").select("id").eq("source_id", attempt.attempt_id).eq("kind", "quiz");
    expect(events.data).toHaveLength(1);
  });

  it("el suspendido no gana puntos y el descalificado no aparece en el ranking", async () => {
    const suspended = await login("JUGADOR9");
    const missions = await call<{ code: string; name: string }[]>(boss, "admin_list_rewards");
    const active = missions.find((mission) => mission.name === "Estación demo")!;
    const refused = await call<{ message: string; ok: boolean }>(suspended, "redeem_reward", { p_channel: "manual", p_code: active.code });

    expect(refused).toEqual({ message: "Tu cuenta no puede sumar puntos.", ok: false });

    const ranking = await call<{ alias: string }[]>(await login("JUGADOR1"), "get_ranking", { p_limit: 100 });
    expect(ranking.map((row) => row.alias)).not.toContain("jugador10");
  });

  it("un admin no puede moderar al superadmin ni usar herramientas de superadmin", async () => {
    const admin = await login("COORDINADOR_DEMO");
    const directory = await call<{ alias: string; user_id: string }[]>(boss, "admin_list_participants", {
      p_age: "", p_department: "", p_limit: 50, p_offset: 0, p_query: "capitana", p_role: "", p_status: "",
    });
    const status = await admin.rpc("admin_set_participant_status", {
      p_reason: "intento indebido de prueba",
      p_status: "suspended",
      p_user_id: directory[0]!.user_id,
    });

    expect(status.error?.message).toBe("Un admin no puede moderar a otro admin ni a un superadmin.");
    expect((await admin.rpc("admin_run_raffle", { p_public_seed: "semilla", p_winners: 1 })).error?.message).toBe(
      "No tienes permiso para esta operación.",
    );
  });
});
