// Two campaigns published at once. Runs only against LOCAL Supabase seeded with
// `npm run seed:demo` (`npm run test:db`). Never points at production.
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

function client(campaign?: string): SupabaseClient {
  return createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
    ...(campaign ? { global: { headers: { "x-campaign": campaign } } } : {}),
  });
}

async function signIn(email: string, password: string, campaign?: string): Promise<SupabaseClient> {
  const supabase = client(campaign);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`login ${email}: ${error.message}`);
  }

  return supabase;
}

function login(name: string, campaign?: string): Promise<SupabaseClient> {
  const value = env[`DEMO_${name}`] ?? "";
  const separator = value.indexOf(":");
  return signIn(value.slice(0, separator), value.slice(separator + 1), campaign);
}

async function call<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw new Error(`${fn}: ${error.message}`);
  }

  return data as T;
}

const iso = (hours: number) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

const quizPayload = (title: string) => ({
  closes_at: iso(24),
  description: "",
  duration_seconds: 300,
  opens_at: iso(-1),
  questions: [
    { explanation: "", max_chars: null, options: [{ correct: true, label: "Sí" }, { correct: false, label: "No" }], points: 30, prompt: "¿Ok?", type: "multiple_choice" },
  ],
  results_visibility: "score",
  shuffle_options: false,
  shuffle_questions: false,
  speed_bonus_enabled: false,
  speed_bonus_max: 0,
  speed_bonus_min: 0,
  speed_fast_threshold_seconds: 0,
  speed_window_seconds: 60,
  title,
});

const landing = {
  sections: [{ eyebrow: "", headline: "Interna", id: "11111111-1111-4111-8111-111111111111", image: null, layout: "split", primaryCtaLabel: "Entrar", secondaryCtaLabel: "", subtitle: "", type: "hero", visible: true }],
  theme: { accent: "carmesi", logo: null, surface: "oscuro" },
};

interface Row {
  alias: string;
  points: number;
}

const summary = (rows: Row[]) => rows.map((row) => `${row.alias}:${row.points}`).sort();

run("campañas privadas simultáneas", () => {
  const slug = `interna-${Date.now()}`;
  const invitedEmail = `invitado-${Date.now()}@demo.local`;
  const invitedPassword = "Volcan-Mango-Lapiz-74";
  let boss: SupabaseClient;
  let bossScoped: SupabaseClient;
  let mainRanking: Row[];
  let mainCount: number;
  let campaignId: string;
  let token: string;
  let quizId: string;
  let rewardCode: string;

  beforeAll(async () => {
    boss = await login("CAPITANA_DEMO");
    mainRanking = await call<Row[]>(boss, "get_ranking", { p_limit: 500 });
    mainCount = (await call<{ eligible_count: number }>(boss, "admin_raffle_preview")).eligible_count;

    campaignId = await call<string>(boss, "admin_create_campaign", { p_landing_draft: landing, p_name: "Dinámica interna", p_slug: slug });
    await call(boss, "admin_set_campaign_private", { p_campaign_id: campaignId, p_private: true });
    await call(boss, "admin_update_campaign", {
      p_campaign_id: campaignId,
      p_ends_at: iso(24 * 30),
      p_name: "Dinámica interna",
      p_prize_description: "",
      p_prize_title: "Premio interno",
      p_slug: slug,
      p_starts_at: iso(-2),
    });
    await call(boss, "admin_publish_rules", { p_campaign_id: campaignId, p_change_summary: "", p_content_md: "# Reglas internas", p_is_major: true });
    await call(boss, "admin_publish_landing", { p_campaign_id: campaignId });
    await call(boss, "admin_set_campaign_status", { p_campaign_id: campaignId, p_reason: "Prueba", p_status: "published" });

    const row = await boss.from("campaigns").select("invite_token").eq("id", campaignId).single();
    token = row.data!.invite_token as string;
    bossScoped = await login("CAPITANA_DEMO", slug);

    quizId = await call<string>(bossScoped, "admin_save_quiz", { p_payload: quizPayload(`Interna ${slug}`), p_quiz_id: null });
    await call(bossScoped, "admin_set_quiz_status", { p_quiz_id: quizId, p_status: "scheduled" });

    const rewardId = await call<string>(bossScoped, "admin_save_reward", {
      p_description: "",
      p_enabled: true,
      p_expires_at: iso(24),
      p_name: `Misión ${slug}`,
      p_points: 20,
      p_reward_id: null,
      p_starts_at: iso(-1),
    });
    rewardCode = (await call<{ code: string }>(boss, "admin_get_reward", { p_reward_id: rewardId })).code;
  });

  it("publica las dos campañas y sigue impidiendo una segunda campaña pública", async () => {
    const published = await boss.from("campaigns").select("is_private").eq("status", "published");
    expect(published.data!.filter((row) => !row.is_private)).toHaveLength(1);
    expect(published.data!.filter((row) => row.is_private).length).toBeGreaterThanOrEqual(1);

    const other = await call<string>(boss, "admin_create_campaign", { p_landing_draft: landing, p_name: "Otra pública", p_slug: `publica-${Date.now()}` });
    await call(boss, "admin_update_campaign", { p_campaign_id: other, p_ends_at: iso(48), p_name: "Otra pública", p_prize_description: "", p_prize_title: "", p_slug: `publica-${Date.now()}`, p_starts_at: iso(-1) });
    await call(boss, "admin_publish_rules", { p_campaign_id: other, p_change_summary: "", p_content_md: "# R", p_is_major: true });
    await call(boss, "admin_publish_landing", { p_campaign_id: other });

    const refused = await boss.rpc("admin_set_campaign_status", { p_campaign_id: other, p_reason: "Prueba", p_status: "published" });
    expect(refused.error?.message).toBe("Ya existe otra campaña publicada.");
  });

  it("guarda la trivia y la misión en la campaña elegida en la consola", async () => {
    const quiz = await boss.from("quizzes").select("campaign_id").eq("id", quizId).single();
    expect(quiz.data!.campaign_id).toBe(campaignId);
    expect(summary(await call<Row[]>(bossScoped, "get_ranking", { p_limit: 500 })).length).toBe(0);
    const scoped = await call<{ name: string }[]>(bossScoped, "admin_list_rewards");
    expect(scoped.map((reward) => reward.name)).toEqual([`Misión ${slug}`]);
    const main = await call<{ name: string }[]>(boss, "admin_list_rewards");
    expect(main.map((reward) => reward.name)).not.toContain(`Misión ${slug}`);
  });

  it("la cabecera no da acceso a quien no es miembro", async () => {
    const outsider = await login("JUGADOR4", slug);
    const landingData = await call<{ campaign: { slug: string } }>(outsider, "get_public_landing");
    expect(landingData.campaign.slug).not.toBe(slug);

    const quizzes = await call<{ id: string }[]>(outsider, "list_my_quizzes");
    expect(quizzes.map((quiz) => quiz.id)).not.toContain(quizId);
    expect((await outsider.rpc("start_quiz_attempt", { p_quiz_id: quizId })).error?.message).toBe("Este cuestionario no está disponible.");
    expect(await call(outsider, "redeem_reward", { p_channel: "manual", p_code: rewardCode })).toEqual({ message: "Código no válido.", ok: false });

    const anonymous = await call<{ campaign: { slug: string } }>(client(slug), "get_public_landing");
    expect(anonymous.campaign.slug).not.toBe(slug);
  });

  it("la campaña no se expone sin el enlace y el enlace no filtra el token", async () => {
    expect(await call(client(), "get_campaign_invite", { p_token: "0".repeat(32) })).toBeNull();
    expect(await call(client(), "get_campaign_invite", { p_token: "x" })).toBeNull();

    const invite = await call<Record<string, unknown>>(client(), "get_campaign_invite", { p_token: token });
    expect(invite).toMatchObject({ campaign: { name: "Dinámica interna", slug }, is_member: false, rules_md: "# Reglas internas" });
    expect(JSON.stringify(invite)).not.toContain(token);

    const landingAnon = await client().from("campaigns").select("id");
    expect(landingAnon.data ?? []).toHaveLength(0);
  });

  it("un participante de la campaña principal se une, juega y sus puntos quedan separados", async () => {
    const before = (await call<{ total: number }>(await login("JUGADOR2"), "get_my_points")).total;
    const plain = await login("JUGADOR2");

    expect(await call(plain, "join_campaign", { p_token: token })).toBe(slug);
    expect(await call(plain, "join_campaign", { p_token: token })).toBe(slug);
    expect((await call<{ campaigns: { slug: string }[]; private_only: boolean }>(plain, "get_my_campaigns")).private_only).toBe(false);

    const player = await login("JUGADOR2", slug);
    expect((await call<{ campaign: { slug: string } }>(player, "get_public_landing")).campaign.slug).toBe(slug);
    expect(await call(player, "get_my_rules_status")).toMatchObject({ required: false });

    const attempt = await call<{ attempt_id: string; questions: { id: string; options: { id: string; label: string }[] }[] }>(player, "start_quiz_attempt", { p_quiz_id: quizId });
    const question = attempt.questions[0]!;
    await call(player, "save_quiz_answer", { p_attempt_id: attempt.attempt_id, p_option_id: question.options.find((option) => option.label === "Sí")!.id, p_question_id: question.id, p_text: null });
    await call(player, "submit_quiz_attempt", { p_attempt_id: attempt.attempt_id });
    expect(await call(player, "redeem_reward", { p_channel: "qr", p_code: rewardCode })).toMatchObject({ ok: true, points: 20 });

    expect((await call<{ total: number }>(player, "get_my_points")).total).toBe(50);
    expect((await call<{ total: number }>(plain, "get_my_points")).total).toBe(before);
    expect(await call(player, "get_ranking", { p_limit: 10 })).toMatchObject([{ alias: "jugador2", points: 50 }]);
    expect(summary(await call<Row[]>(plain, "get_ranking", { p_limit: 500 }))).toEqual(summary(mainRanking));
  });

  it("una cuenta creada por invitación solo existe en la campaña privada", async () => {
    const admin = createClient(env.SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    const created = await admin.auth.admin.createUser({
      email: invitedEmail,
      email_confirm: true,
      password: invitedPassword,
      user_metadata: {
        accepted_privacy: true,
        accepted_rules: true,
        age_declaration: "adult",
        alias: `invitado${Date.now() % 100000}`,
        avatar_id: "avatar-01",
        birth_date: "1995-05-05",
        department: "San Salvador",
        first_name: "Ana",
        invite_token: token,
        last_name: "Invitada",
        phone: "+50371234567",
      },
    });
    expect(created.error).toBeNull();

    const invited = await signIn(invitedEmail, invitedPassword);
    const mine = await call<{ campaigns: { slug: string }[]; private_only: boolean }>(invited, "get_my_campaigns");
    expect(mine.private_only).toBe(true);
    expect(mine.campaigns.map((campaign) => campaign.slug)).toEqual([slug]);

    // Not in the main campaign: ranking, raffle and directory stay untouched.
    expect(summary(await call<Row[]>(boss, "get_ranking", { p_limit: 500 }))).toEqual(summary(mainRanking));
    expect((await call<{ eligible_count: number }>(boss, "admin_raffle_preview")).eligible_count).toBe(mainCount);
    const params = { p_age: "", p_department: "", p_limit: 50, p_offset: 0, p_query: "invitada", p_role: "", p_status: "" };
    expect(await call<unknown[]>(boss, "admin_list_participants", params)).toHaveLength(0);
    expect(await call<unknown[]>(bossScoped, "admin_list_participants", params)).toHaveLength(1);

    // The database refuses main-campaign activity even if the UI is bypassed.
    const mainQuiz = (await call<{ id: string; phase: string }[]>(invited, "list_my_quizzes")).find((quiz) => quiz.phase === "active");
    expect((await invited.rpc("start_quiz_attempt", { p_quiz_id: mainQuiz!.id })).error?.message).toBe("Tu cuenta no participa en esta campaña.");
    const mission = (await call<{ code: string; name: string }[]>(boss, "admin_list_rewards")).find((reward) => reward.name === "Estación demo");
    expect((await invited.rpc("redeem_reward", { p_channel: "manual", p_code: mission!.code })).error?.message).toBe("Tu cuenta no participa en esta campaña.");

    // Inside its campaign it plays normally, with the rules already accepted.
    const scoped = await signIn(invitedEmail, invitedPassword, slug);
    expect(await call(scoped, "get_my_rules_status")).toMatchObject({ required: false });
    expect(await call(scoped, "redeem_reward", { p_channel: "manual", p_code: rewardCode })).toMatchObject({ ok: true });
    expect((await call<Row[]>(scoped, "get_ranking", { p_limit: 10 })).map((row) => row.points).sort()).toEqual([20, 50]);
  });

  it("la cuenta invitada puede sumarse después a la campaña principal", async () => {
    const invited = await signIn(invitedEmail, invitedPassword);
    await call(invited, "join_primary_campaign");

    expect((await call<{ private_only: boolean }>(invited, "get_my_campaigns")).private_only).toBe(false);
    expect(await call(invited, "get_my_rules_status")).toMatchObject({ required: true });
    expect((await call<Row[]>(boss, "get_ranking", { p_limit: 500 })).length).toBe(mainRanking.length + 1);
  });

  it("pausar o renovar el enlace bloquea entradas nuevas sin sacar a nadie", async () => {
    const newcomer = await login("JUGADOR5");

    await call(boss, "admin_set_campaign_invite", { p_campaign_id: campaignId, p_enabled: false });
    expect((await newcomer.rpc("join_campaign", { p_token: token })).error?.message).toBe("Este enlace de invitación no es válido o ya no está activo.");
    await call(boss, "admin_set_campaign_invite", { p_campaign_id: campaignId, p_enabled: true });

    await call(boss, "admin_regenerate_campaign_invite", { p_campaign_id: campaignId });
    expect((await newcomer.rpc("join_campaign", { p_token: token })).error?.message).toBe("Este enlace de invitación no es válido o ya no está activo.");

    const member = await login("JUGADOR2", slug);
    expect((await call<{ campaign: { slug: string } }>(member, "get_public_landing")).campaign.slug).toBe(slug);
  });

  it("las cuentas del equipo no se unen y un participante no administra invitaciones", async () => {
    const row = await boss.from("campaigns").select("invite_token").eq("id", campaignId).single();
    const current = row.data!.invite_token as string;

    expect((await boss.rpc("join_campaign", { p_token: current })).error?.message).toBe("Las cuentas del equipo organizador no participan en las campañas.");

    const player = await login("JUGADOR6");
    expect((await player.rpc("admin_set_campaign_private", { p_campaign_id: campaignId, p_private: false })).error?.message).toBe("No tienes permiso para esta operación.");
    expect((await player.rpc("admin_regenerate_campaign_invite", { p_campaign_id: campaignId })).error?.message).toBe("No tienes permiso para esta operación.");
    expect((await boss.rpc("admin_set_campaign_private", { p_campaign_id: campaignId, p_private: false })).error?.message).toBe("Solo una campaña en borrador puede cambiar de tipo.");
    expect((await player.from("campaigns").select("invite_token")).data ?? []).toHaveLength(0);
  });
});
