// Demo data for a LOCAL Supabase only (`npx supabase start`). Refuses any
// other target. Everything goes through the app's own RPCs, so the seed
// exercises the same rules as production. Credentials are written to
// .env.demo.local (git-ignored) and never printed.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");

try {
  process.loadEnvFile(resolve(root, ".env.demo.local"));
} catch {
  // Optional: values may come from the shell instead.
}

const url = process.env.SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

function assertLocalTarget() {
  let host = "";

  try {
    host = new URL(url).hostname;
  } catch {
    // handled below
  }

  if (process.env.SUPABASE_ENVIRONMENT !== "local" || !["127.0.0.1", "localhost"].includes(host)) {
    throw new Error("seed:demo solo se ejecuta contra Supabase local (SUPABASE_ENVIRONMENT=local y host 127.0.0.1/localhost).");
  }

  if (!secretKey || !publishableKey) {
    throw new Error("Faltan SUPABASE_SECRET_KEY y SUPABASE_PUBLISHABLE_KEY locales (usa `npx supabase status -o env`).");
  }
}

assertLocalTarget();

const service = createClient(url, secretKey, { auth: { persistSession: false } });
const password = () => `${randomBytes(12).toString("base64url")}Aa9!`;
const iso = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();
const LAST_NAMES = ["Ramírez", "López", "Hernández", "Martínez", "Rivas", "Flores", "Cruz", "Mejía"];
const DEPARTMENTS = ["San Salvador", "Santa Ana", "La Libertad", "San Miguel", "Sonsonate"];

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);

  if (error) {
    throw new Error(`${name}: ${error.message}`);
  }

  return data;
}

async function createAccount(index, alias) {
  const email = `${alias}@demo.local`;
  const pass = password();
  const { error } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    password: pass,
    user_metadata: {
      accepted_privacy: true,
      accepted_rules: true,
      age_declaration: "adult",
      alias,
      avatar_id: `avatar-${String((index % 12) + 1).padStart(2, "0")}`,
      birth_date: `199${index % 10}-0${(index % 9) + 1}-15`,
      department: DEPARTMENTS[index % DEPARTMENTS.length],
      first_name: "Demo",
      last_name: LAST_NAMES[index % LAST_NAMES.length],
      marketing_consent: index % 2 === 0,
      phone: `+5037${String(1000000 + index).slice(-7)}`,
    },
  });

  if (error) {
    throw new Error(`createUser ${alias}: ${error.message}`);
  }

  return { alias, email, password: pass };
}

async function signIn(account) {
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });

  if (error) {
    throw new Error(`login ${account.alias}: ${error.message}`);
  }

  return client;
}

const superadmin = await createAccount(0, "capitana-demo");
const admin = await createAccount(1, "coordinador-demo");
const participants = [];

for (let index = 2; index < 12; index += 1) {
  participants.push(await createAccount(index, `jugador${index - 1}`));
}

await rpc(service, "bootstrap_first_superadmin", { p_email: superadmin.email });
const boss = await signIn(superadmin);
await rpc(boss, "admin_set_role", { p_email: admin.email, p_reason: "Cuenta admin de demostración", p_role: "admin" });

// Campaign: rules + landing + dates, then published.
const landing = {
  sections: [
    {
      eyebrow: "Demo",
      headline: "Campaña de demostración",
      id: "11111111-1111-4111-8111-111111111111",
      image: null,
      layout: "centered",
      primaryCtaLabel: "Participar",
      secondaryCtaLabel: "Iniciar sesión",
      subtitle: "Datos ficticios para probar la plataforma en local.",
      type: "hero",
      visible: true,
    },
    { heading: "Top 5", id: "22222222-2222-4222-8222-222222222222", limit: 5, note: "", type: "ranking_preview", visible: true },
  ],
  theme: { accent: "carmesi", logo: null, surface: "oscuro" },
};
const campaignId = await rpc(boss, "admin_create_campaign", { p_landing_draft: landing, p_name: "Campaña demo", p_slug: "campana-demo" });
await rpc(boss, "admin_update_campaign", {
  p_campaign_id: campaignId,
  p_ends_at: iso(24 * 60),
  p_name: "Campaña demo",
  p_prize_description: "Premio de demostración.",
  p_prize_title: "Equipo MSI (demo)",
  p_slug: "campana-demo",
  p_starts_at: iso(-24),
});
await rpc(boss, "admin_publish_rules", {
  p_campaign_id: campaignId,
  p_change_summary: "Reglas demo",
  p_content_md: "## Reglas de demostración\n\n1. Participación gratuita.\n2. Una cuenta por persona.",
  p_is_major: true,
});
await rpc(boss, "admin_publish_landing", { p_campaign_id: campaignId });
await rpc(boss, "admin_set_campaign_status", { p_campaign_id: campaignId, p_reason: "Demo", p_status: "published" });
await rpc(boss, "admin_update_ranking_settings", {
  p_audience: "public",
  p_campaign_id: campaignId,
  p_highlight_top: 5,
  p_identity: "alias_passport",
  p_visible: true,
});

// Quizzes: one that will be closed after attempts, one active, one future.
const quizPayload = (title, opensIn, closesIn) => ({
  closes_at: iso(closesIn),
  description: "Trivia de demostración",
  duration_seconds: 600,
  opens_at: iso(opensIn),
  questions: [
    { explanation: "Es 4.", max_chars: null, options: [{ correct: false, label: "3" }, { correct: true, label: "4" }], points: 10, prompt: "¿Cuánto es 2 + 2?", type: "multiple_choice" },
    { explanation: "", max_chars: null, options: [{ correct: true, label: "San Salvador" }, { correct: false, label: "Santa Ana" }], points: 10, prompt: "Capital de El Salvador", type: "multiple_choice" },
    { explanation: "", max_chars: 300, options: [], points: 20, prompt: "Describe tu laptop ideal.", type: "open_text" },
  ],
  results_visibility: "score_and_solutions_after_close",
  shuffle_options: true,
  shuffle_questions: false,
  speed_bonus_enabled: true,
  speed_bonus_max: 20,
  speed_bonus_min: 0,
  speed_fast_threshold_seconds: 60,
  speed_window_seconds: 300,
  title,
});

const closedQuizId = await rpc(boss, "admin_save_quiz", { p_payload: quizPayload("Trivia semana 1", -2, 1), p_quiz_id: null });
await rpc(boss, "admin_set_quiz_status", { p_quiz_id: closedQuizId, p_status: "scheduled" });
const activeQuizId = await rpc(boss, "admin_save_quiz", { p_payload: quizPayload("Trivia semana 2", -1, 24 * 7), p_quiz_id: null });
await rpc(boss, "admin_set_quiz_status", { p_quiz_id: activeQuizId, p_status: "scheduled" });
const futureQuizId = await rpc(boss, "admin_save_quiz", { p_payload: quizPayload("Trivia semana 3", 24 * 3, 24 * 4), p_quiz_id: null });
await rpc(boss, "admin_set_quiz_status", { p_quiz_id: futureQuizId, p_status: "scheduled" });

const key = await rpc(boss, "admin_get_quiz", { p_quiz_id: closedQuizId });
const correct = new Map(key.questions.map((q) => [q.id, q.options.find((o) => o.correct)?.id ?? null]));
const wrong = new Map(key.questions.map((q) => [q.id, q.options.find((o) => !o.correct)?.id ?? null]));

// Rewards: active, future and expired.
const activeReward = await rpc(boss, "admin_save_reward", {
  p_description: "Visita la estación demo",
  p_enabled: true,
  p_expires_at: iso(48),
  p_name: "Estación demo",
  p_points: 25,
  p_reward_id: null,
  p_starts_at: iso(-1),
});
await rpc(boss, "admin_save_reward", { p_description: "", p_enabled: true, p_expires_at: iso(96), p_name: "Misión futura", p_points: 15, p_reward_id: null, p_starts_at: iso(72) });
await rpc(boss, "admin_save_reward", { p_description: "", p_enabled: true, p_expires_at: iso(-24), p_name: "Misión vencida", p_points: 15, p_reward_id: null, p_starts_at: iso(-48) });
const { code } = await rpc(boss, "admin_get_reward", { p_reward_id: activeReward });

// Participants play with varied accuracy so the ranking has ties and gaps.
for (const [index, account] of participants.entries()) {
  const client = await signIn(account);
  const attempt = await rpc(client, "start_quiz_attempt", { p_quiz_id: closedQuizId });

  for (const question of attempt.questions) {
    if (question.type === "multiple_choice") {
      const pick = index % 3 === 0 ? wrong.get(question.id) : correct.get(question.id);
      await rpc(client, "save_quiz_answer", { p_attempt_id: attempt.attempt_id, p_option_id: pick, p_question_id: question.id, p_text: null });
    } else if (index % 2 === 0) {
      await rpc(client, "save_quiz_answer", { p_attempt_id: attempt.attempt_id, p_option_id: null, p_question_id: question.id, p_text: "Una laptop MSI con buena GPU." });
    }
  }

  await rpc(client, "submit_quiz_attempt", { p_attempt_id: attempt.attempt_id });

  if (index < 6) {
    await rpc(client, "redeem_reward", { p_channel: index % 2 ? "qr" : "manual", p_code: code });
  }
}

await rpc(boss, "admin_set_quiz_status", { p_quiz_id: closedQuizId, p_status: "closed" });

// One open answer reviewed; the rest stay pending (provisional ranking).
const queue = await rpc(boss, "admin_review_queue", {});

if (queue[0]) {
  await rpc(boss, "admin_review_answer", { p_attempt_id: queue[0].attempt_id, p_note: "Buena respuesta", p_points: 15, p_question_id: queue[0].question_id });
}

const directory = await rpc(boss, "admin_list_participants", { p_age: "", p_department: "", p_limit: 50, p_offset: 0, p_query: "jugador", p_role: "", p_status: "" });
const byAlias = new Map(directory.map((row) => [row.alias, row.user_id]));
await rpc(boss, "admin_set_participant_status", { p_reason: "Suspensión de demostración", p_status: "suspended", p_user_id: byAlias.get("jugador9") });
await rpc(boss, "admin_set_participant_status", { p_reason: "Descalificación de demostración", p_status: "disqualified", p_user_id: byAlias.get("jugador10") });

const lines = [
  "# Generado por npm run seed:demo — solo local, no compartir.",
  `SUPABASE_ENVIRONMENT=local`,
  `SUPABASE_URL=${url}`,
  `SUPABASE_SECRET_KEY=${secretKey}`,
  `SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
  ...[superadmin, admin, ...participants].map((account) => `DEMO_${account.alias.replace(/-/g, "_").toUpperCase()}=${account.email}:${account.password}`),
];
writeFileSync(resolve(root, ".env.demo.local"), `${lines.join("\n")}\n`);

console.log(`Seed listo: 1 superadmin, 1 admin, ${participants.length} participantes, 3 trivias, 3 misiones.`);
console.log("Credenciales guardadas en .env.demo.local (no se imprimen).");
