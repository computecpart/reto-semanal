begin;

-- ===========================================================================
-- Types
-- ===========================================================================

create type public.quiz_status as enum ('draft', 'scheduled', 'closed', 'archived');
create type public.quiz_question_type as enum ('multiple_choice', 'open_text');
create type public.quiz_results_visibility as enum ('none', 'score', 'score_and_solutions_after_close');
create type public.quiz_attempt_status as enum (
  'started', 'submitted', 'submitted_pending_review', 'scored', 'expired', 'invalidated'
);
create type public.quiz_review_status as enum ('pending', 'approved', 'partial', 'rejected');

revoke all on type public.quiz_status from public, anon;
revoke all on type public.quiz_question_type from public, anon;
revoke all on type public.quiz_results_visibility from public, anon;
revoke all on type public.quiz_attempt_status from public, anon;
revoke all on type public.quiz_review_status from public, anon;
grant usage on type public.quiz_status to authenticated;
grant usage on type public.quiz_question_type to authenticated;
grant usage on type public.quiz_results_visibility to authenticated;
grant usage on type public.quiz_attempt_status to authenticated;
grant usage on type public.quiz_review_status to authenticated;

-- ===========================================================================
-- Tables (clients never read them directly; participants use RPCs only)
-- ===========================================================================

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  title text not null check (title = btrim(title) and char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 30 and 7200),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  results_visibility public.quiz_results_visibility not null default 'score_and_solutions_after_close',
  speed_bonus_enabled boolean not null default false,
  speed_bonus_max integer not null default 0 check (speed_bonus_max between 0 and 10000),
  speed_bonus_min integer not null default 0 check (speed_bonus_min >= 0),
  speed_fast_threshold_seconds integer not null default 0 check (speed_fast_threshold_seconds >= 0),
  speed_window_seconds integer not null default 60,
  status public.quiz_status not null default 'draft',
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint quizzes_window check (closes_at > opens_at),
  constraint quizzes_speed_range check (
    speed_bonus_min <= speed_bonus_max and speed_window_seconds > speed_fast_threshold_seconds
  )
);

create index quizzes_campaign on public.quizzes (campaign_id, opens_at);

create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function private.set_updated_at();

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position integer not null check (position between 1 and 100),
  type public.quiz_question_type not null,
  prompt text not null check (char_length(prompt) between 1 and 1000),
  points integer not null check (points between 0 and 10000),
  max_chars integer check (max_chars is null or max_chars between 10 and 2000),
  unique (quiz_id, position),
  constraint quiz_questions_open_text_limit check ((type = 'open_text') = (max_chars is not null))
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position integer not null check (position between 1 and 10),
  label text not null check (char_length(label) between 1 and 300),
  unique (question_id, position)
);

-- Correct answers and explanations live outside the exposed schema.
create table private.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_id uuid references public.quiz_options (id) on delete cascade,
  explanation text not null default '' check (char_length(explanation) <= 1000)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete restrict,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  status public.quiz_attempt_status not null default 'started',
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  finalized_late boolean not null default false,
  question_order uuid[] not null,
  option_order jsonb not null default '{}'::jsonb,
  correct_count integer not null default 0,
  auto_score integer not null default 0,
  review_score integer not null default 0,
  bonus_score integer not null default 0,
  unique (quiz_id, user_id)
);

create index quiz_attempts_user on public.quiz_attempts (user_id, status);

create table public.quiz_answers (
  attempt_id uuid not null references public.quiz_attempts (id) on delete restrict,
  question_id uuid not null references public.quiz_questions (id) on delete restrict,
  selected_option_id uuid references public.quiz_options (id) on delete restrict,
  text_answer text check (text_answer is null or char_length(text_answer) <= 2000),
  saved_at timestamptz not null default now(),
  review_status public.quiz_review_status,
  review_points integer check (review_points is null or review_points >= 0),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  review_revision integer not null default 0,
  reviewed_by uuid,
  reviewed_at timestamptz,
  primary key (attempt_id, question_id)
);

create index quiz_answers_pending on public.quiz_answers (review_status) where review_status = 'pending';

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table private.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

revoke all on table public.quizzes from public, anon, authenticated;
revoke all on table public.quiz_questions from public, anon, authenticated;
revoke all on table public.quiz_options from public, anon, authenticated;
revoke all on table private.quiz_answer_keys from public, anon, authenticated;
revoke all on table public.quiz_attempts from public, anon, authenticated;
revoke all on table public.quiz_answers from public, anon, authenticated;

grant select on table public.quizzes to authenticated;
grant select on table public.quiz_attempts to authenticated;

create policy "quizzes_admin_read" on public.quizzes
for select to authenticated using ((select public.is_admin()));

create policy "quiz_attempts_admin_read" on public.quiz_attempts
for select to authenticated using ((select public.is_admin()));

-- ===========================================================================
-- Locking: once someone has started, scoring content is frozen
-- ===========================================================================

create function private.guard_locked_quiz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_quiz_id uuid;
begin
  if tg_table_name = 'quizzes' then
    if old.locked_at is not null and (
      new.duration_seconds is distinct from old.duration_seconds
      or new.opens_at is distinct from old.opens_at
      or new.shuffle_questions is distinct from old.shuffle_questions
      or new.shuffle_options is distinct from old.shuffle_options
      or new.speed_bonus_enabled is distinct from old.speed_bonus_enabled
      or new.speed_bonus_max is distinct from old.speed_bonus_max
      or new.speed_bonus_min is distinct from old.speed_bonus_min
      or new.speed_fast_threshold_seconds is distinct from old.speed_fast_threshold_seconds
      or new.speed_window_seconds is distinct from old.speed_window_seconds
      or new.campaign_id is distinct from old.campaign_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'El cuestionario ya tiene participaciones: duplícalo para cambiarlo.';
    end if;

    return new;
  end if;

  if tg_table_name = 'quiz_questions' then
    v_quiz_id := case when tg_op = DELETE then old.quiz_id else new.quiz_id end;
  else
    v_question_id := case when tg_op = 'DELETE' then old.question_id else new.question_id end;
    select questions.quiz_id into v_quiz_id
    from public.quiz_questions as questions
    where questions.id = v_question_id;
  end if;

  if exists (
    select 1 from public.quizzes as quizzes
    where quizzes.id = v_quiz_id and quizzes.locked_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'El cuestionario ya tiene participaciones: duplícalo para cambiarlo.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.guard_locked_quiz() from public, anon, authenticated;

create trigger quizzes_guard_locked
before update on public.quizzes
for each row execute function private.guard_locked_quiz();

create trigger quiz_questions_guard_locked
before insert or update or delete on public.quiz_questions
for each row execute function private.guard_locked_quiz();

create trigger quiz_options_guard_locked
before insert or update or delete on public.quiz_options
for each row execute function private.guard_locked_quiz();

create trigger quiz_answer_keys_guard_locked
before insert or update or delete on private.quiz_answer_keys
for each row execute function private.guard_locked_quiz();

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- Linear speed bonus scaled by multiple-choice accuracy, rounded down.
-- t <= threshold -> max; t >= window -> min; linear in between.
create function private.speed_bonus(
  p_elapsed_seconds numeric,
  p_max integer,
  p_min integer,
  p_threshold integer,
  p_window integer,
  p_accuracy numeric
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, pg_catalog.floor(
    (case
      when p_elapsed_seconds <= p_threshold then p_max
      when p_elapsed_seconds >= p_window then p_min
      else p_max - (p_max - p_min) * (p_elapsed_seconds - p_threshold) / (p_window - p_threshold)
    end) * least(greatest(coalesce(p_accuracy, 0), 0), 1)
  ))::integer;
$$;

revoke all on function private.speed_bonus(numeric, integer, integer, integer, integer, numeric)
from public, anon, authenticated;

create function private.campaign_accepting_points(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns as campaigns
    where campaigns.id = p_campaign_id
      and campaigns.status = 'published'::public.campaign_status
      and pg_catalog.statement_timestamp() >= campaigns.starts_at
      and pg_catalog.statement_timestamp() < campaigns.ends_at
  );
$$;

revoke all on function private.campaign_accepting_points(uuid) from public, anon, authenticated;

create function private.quiz_phase(p_quiz public.quizzes)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_quiz.status = 'scheduled'::public.quiz_status
      and pg_catalog.statement_timestamp() < p_quiz.opens_at then 'upcoming'
    when p_quiz.status = 'scheduled'::public.quiz_status
      and pg_catalog.statement_timestamp() < p_quiz.closes_at then 'active'
    else 'ended'
  end;
$$;

revoke all on function private.quiz_phase(public.quizzes) from public, anon, authenticated;

create function private.validate_quiz(p_quiz_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.quiz_questions where quiz_id = p_quiz_id) then
    raise exception using errcode = '22023', message = 'Agrega al menos una pregunta.';
  end if;

  if exists (
    select 1 from public.quiz_questions as questions
    where questions.quiz_id = p_quiz_id
      and questions.type = 'multiple_choice'::public.quiz_question_type
      and (select count(*) from public.quiz_options as options where options.question_id = questions.id) < 2
  ) then
    raise exception using errcode = '22023', message = 'Cada pregunta de opción múltiple necesita al menos 2 opciones.';
  end if;

  if exists (
    select 1 from public.quiz_questions as questions
    left join private.quiz_answer_keys as keys on keys.question_id = questions.id
    where questions.quiz_id = p_quiz_id
      and questions.type = 'multiple_choice'::public.quiz_question_type
      and keys.correct_option_id is null
  ) then
    raise exception using errcode = '22023', message = 'Marca la respuesta correcta de cada pregunta de opción múltiple.';
  end if;
end;
$$;

revoke all on function private.validate_quiz(uuid) from public, anon, authenticated;

-- Questions in the attempt's frozen order, without any correction data.
create function private.attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'attempt_id', attempts.id,
    'status', attempts.status,
    'started_at', attempts.started_at,
    'deadline_at', least(attempts.deadline_at, quizzes.closes_at),
    'server_now', pg_catalog.statement_timestamp(),
    'quiz', pg_catalog.jsonb_build_object(
      'id', quizzes.id,
      'title', quizzes.title,
      'description', quizzes.description,
      'duration_seconds', quizzes.duration_seconds
    ),
    'questions', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', questions.id,
          'type', questions.type,
          'prompt', questions.prompt,
          'points', questions.points,
          'max_chars', questions.max_chars,
          'options', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object('id', options.id, 'label', options.label)
              order by pg_catalog.array_position(
                array(select pg_catalog.jsonb_array_elements_text(attempts.option_order -> questions.id::text)),
                options.id::text
              ), options.position
            )
            from public.quiz_options as options
            where options.question_id = questions.id
          ), '[]'::jsonb)
        )
        order by pg_catalog.array_position(attempts.question_order, questions.id)
      )
      from public.quiz_questions as questions
      where questions.quiz_id = quizzes.id
    ), '[]'::jsonb),
    'answers', coalesce((
      select pg_catalog.jsonb_object_agg(
        answers.question_id,
        pg_catalog.jsonb_build_object('option_id', answers.selected_option_id, 'text', answers.text_answer)
      )
      from public.quiz_answers as answers
      where answers.attempt_id = attempts.id
    ), '{}'::jsonb)
  )
  from public.quiz_attempts as attempts
  join public.quizzes as quizzes on quizzes.id = attempts.quiz_id
  where attempts.id = p_attempt_id;
$$;

revoke all on function private.attempt_payload(uuid) from public, anon, authenticated;

-- Scores an attempt once. p_on_time = false for lazy expiry: only answers
-- saved before the deadline count and no speed bonus is granted.
create function private.finalize_attempt(p_attempt_id uuid, p_on_time boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_quiz public.quizzes;
  v_deadline timestamptz;
  v_submitted_at timestamptz;
  v_mc_possible integer;
  v_mc_earned integer;
  v_correct integer;
  v_pending boolean;
  v_bonus integer := 0;
  v_status public.quiz_attempt_status;
  v_can_award boolean;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;

  if not found or v_attempt.status <> 'started'::public.quiz_attempt_status then
    return;
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  v_deadline := least(v_attempt.deadline_at, v_quiz.closes_at);
  v_submitted_at := least(pg_catalog.statement_timestamp(), v_deadline);

  select
    coalesce(sum(questions.points), 0),
    coalesce(sum(questions.points) filter (where answers.selected_option_id = keys.correct_option_id), 0),
    count(*) filter (where answers.selected_option_id = keys.correct_option_id)
  into v_mc_possible, v_mc_earned, v_correct
  from public.quiz_questions as questions
  left join private.quiz_answer_keys as keys on keys.question_id = questions.id
  left join public.quiz_answers as answers
    on answers.attempt_id = v_attempt.id and answers.question_id = questions.id
  where questions.quiz_id = v_quiz.id
    and questions.type = 'multiple_choice'::public.quiz_question_type;

  update public.quiz_answers as answers
  set review_status = 'pending'::public.quiz_review_status
  from public.quiz_questions as questions
  where answers.attempt_id = v_attempt.id
    and questions.id = answers.question_id
    and questions.type = 'open_text'::public.quiz_question_type
    and coalesce(pg_catalog.btrim(answers.text_answer), '') <> '';

  v_pending := found;

  if p_on_time and v_quiz.speed_bonus_enabled and v_mc_possible > 0 then
    v_bonus := private.speed_bonus(
      extract(epoch from (v_submitted_at - v_attempt.started_at))::numeric,
      v_quiz.speed_bonus_max,
      v_quiz.speed_bonus_min,
      v_quiz.speed_fast_threshold_seconds,
      v_quiz.speed_window_seconds,
      v_mc_earned::numeric / v_mc_possible
    );
  end if;

  v_can_award := private.is_competitor(v_attempt.user_id)
    and private.participant_can_earn(v_attempt.user_id)
    and private.campaign_accepting_points(v_attempt.campaign_id);

  v_status := case
    when not v_can_award then 'invalidated'::public.quiz_attempt_status
    when v_pending then 'submitted_pending_review'::public.quiz_attempt_status
    when p_on_time then 'scored'::public.quiz_attempt_status
    else 'expired'::public.quiz_attempt_status
  end;

  if v_can_award and v_mc_earned > 0 then
    perform private.award_points(
      v_attempt.campaign_id, v_attempt.user_id, v_mc_earned, 'quiz'::public.point_event_kind,
      'quiz_attempt', v_attempt.id::text, pg_catalog.left('Trivia: ' || v_quiz.title, 200), v_correct, true
    );
  end if;

  if v_can_award and v_bonus > 0 then
    perform private.award_points(
      v_attempt.campaign_id, v_attempt.user_id, v_bonus, 'quiz_speed_bonus'::public.point_event_kind,
      'quiz_attempt', v_attempt.id::text, pg_catalog.left('Bono de velocidad: ' || v_quiz.title, 200), 0, false
    );
  end if;

  update public.quiz_attempts
  set
    status = v_status,
    submitted_at = v_submitted_at,
    finalized_late = not p_on_time,
    correct_count = v_correct,
    auto_score = case when v_can_award then v_mc_earned else 0 end,
    bonus_score = case when v_can_award then v_bonus else 0 end
  where id = v_attempt.id;
end;
$$;

revoke all on function private.finalize_attempt(uuid, boolean) from public, anon, authenticated;

-- Lazy expiry: attempts past their deadline are finalized when touched.
create function private.finalize_expired_attempts(p_user_id uuid, p_quiz_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_id uuid;
begin
  for v_attempt_id in
    select attempts.id
    from public.quiz_attempts as attempts
    join public.quizzes as quizzes on quizzes.id = attempts.quiz_id
    where attempts.status = 'started'::public.quiz_attempt_status
      and (p_user_id is null or attempts.user_id = p_user_id)
      and (p_quiz_id is null or attempts.quiz_id = p_quiz_id)
      and pg_catalog.statement_timestamp() >= least(attempts.deadline_at, quizzes.closes_at)
  loop
    perform private.finalize_attempt(v_attempt_id, false);
  end loop;
end;
$$;

revoke all on function private.finalize_expired_attempts(uuid, uuid) from public, anon, authenticated;

-- ===========================================================================
-- Participant RPCs
-- ===========================================================================

create function public.list_my_quizzes()
returns table (
  id uuid,
  title text,
  description text,
  opens_at timestamptz,
  closes_at timestamptz,
  duration_seconds integer,
  question_count integer,
  max_points integer,
  phase text,
  attempt_status public.quiz_attempt_status,
  score integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  perform private.finalize_expired_attempts((select auth.uid()), null);

  return query
  select
    quizzes.id,
    quizzes.title,
    quizzes.description,
    quizzes.opens_at,
    quizzes.closes_at,
    quizzes.duration_seconds,
    (select count(*)::integer from public.quiz_questions as questions where questions.quiz_id = quizzes.id),
    (select coalesce(sum(questions.points), 0)::integer from public.quiz_questions as questions where questions.quiz_id = quizzes.id),
    private.quiz_phase(quizzes),
    attempts.status,
    case
      when attempts.status in ('started'::public.quiz_attempt_status, 'invalidated'::public.quiz_attempt_status)
        or quizzes.results_visibility = 'none'::public.quiz_results_visibility then null
      else attempts.auto_score + attempts.review_score + attempts.bonus_score
    end
  from public.quizzes as quizzes
  left join public.quiz_attempts as attempts
    on attempts.quiz_id = quizzes.id and attempts.user_id = (select auth.uid())
  where quizzes.campaign_id = private.current_campaign_id()
    and quizzes.status in ('scheduled'::public.quiz_status, 'closed'::public.quiz_status)
  order by quizzes.opens_at desc;
end;
$$;

create function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_quiz public.quizzes;
  v_attempt public.quiz_attempts;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  perform private.finalize_expired_attempts(v_user_id, p_quiz_id);

  select * into v_attempt from public.quiz_attempts where quiz_id = p_quiz_id and user_id = v_user_id;

  if found then
    if v_attempt.status <> 'started'::public.quiz_attempt_status then
      raise exception using errcode = '23505', message = 'Ya completaste este cuestionario.';
    end if;

    return private.attempt_payload(v_attempt.id);
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;

  if not found or v_quiz.campaign_id is distinct from private.current_campaign_id()
    or private.quiz_phase(v_quiz) <> 'active' then
    raise exception using errcode = '55000', message = 'Este cuestionario no está disponible.';
  end if;

  if not private.is_competitor(v_user_id) or not private.participant_can_earn(v_user_id) then
    raise exception using errcode = '42501', message = 'Tu cuenta no puede participar en cuestionarios.';
  end if;

  if not private.campaign_accepting_points(v_quiz.campaign_id) then
    raise exception using errcode = '55000', message = 'La campaña no está recibiendo puntuaciones.';
  end if;

  insert into public.quiz_attempts (quiz_id, campaign_id, user_id, deadline_at, question_order, option_order)
  values (
    v_quiz.id,
    v_quiz.campaign_id,
    v_user_id,
    least(v_quiz.closes_at, pg_catalog.statement_timestamp() + pg_catalog.make_interval(secs => v_quiz.duration_seconds)),
    array(
      select questions.id from public.quiz_questions as questions
      where questions.quiz_id = v_quiz.id
      order by case when v_quiz.shuffle_questions then pg_catalog.random() else questions.position::double precision end
    ),
    coalesce((
      select pg_catalog.jsonb_object_agg(questions.id, array(
        select options.id from public.quiz_options as options
        where options.question_id = questions.id
        order by case when v_quiz.shuffle_options then pg_catalog.random() else options.position::double precision end
      ))
      from public.quiz_questions as questions
      where questions.quiz_id = v_quiz.id
    ), '{}'::jsonb)
  )
  on conflict (quiz_id, user_id) do nothing
  returning * into v_attempt;

  if v_attempt.id is null then
    select * into v_attempt from public.quiz_attempts where quiz_id = p_quiz_id and user_id = v_user_id;
  end if;

  update public.quizzes set locked_at = pg_catalog.statement_timestamp()
  where id = v_quiz.id and locked_at is null;

  return private.attempt_payload(v_attempt.id);
end;
$$;

create function public.save_quiz_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_option_id uuid,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_closes_at timestamptz;
  v_question public.quiz_questions;
begin
  select * into v_attempt
  from public.quiz_attempts
  where id = p_attempt_id and user_id = (select auth.uid());

  if not found then
    raise exception using errcode = '42501', message = 'No puedes responder este intento.';
  end if;

  select quizzes.closes_at into v_closes_at from public.quizzes as quizzes where quizzes.id = v_attempt.quiz_id;

  if v_attempt.status <> 'started'::public.quiz_attempt_status
    or pg_catalog.statement_timestamp() >= least(v_attempt.deadline_at, v_closes_at) then
    raise exception using errcode = '55000', message = 'El tiempo de este cuestionario terminó.';
  end if;

  select * into v_question from public.quiz_questions
  where id = p_question_id and quiz_id = v_attempt.quiz_id;

  if not found then
    raise exception using errcode = '22023', message = 'La pregunta no pertenece a este cuestionario.';
  end if;

  if v_question.type = 'multiple_choice'::public.quiz_question_type then
    if p_option_id is not null and not exists (
      select 1 from public.quiz_options where id = p_option_id and question_id = p_question_id
    ) then
      raise exception using errcode = '22023', message = 'La opción no es válida.';
    end if;
  elsif char_length(coalesce(p_text, '')) > v_question.max_chars then
    raise exception using errcode = '22023', message = 'La respuesta supera el máximo de caracteres.';
  end if;

  insert into public.quiz_answers (attempt_id, question_id, selected_option_id, text_answer, saved_at)
  values (
    p_attempt_id,
    p_question_id,
    case when v_question.type = 'multiple_choice'::public.quiz_question_type then p_option_id end,
    case when v_question.type = 'open_text'::public.quiz_question_type then p_text end,
    pg_catalog.statement_timestamp()
  )
  on conflict (attempt_id, question_id) do update
  set
    selected_option_id = excluded.selected_option_id,
    text_answer = excluded.text_answer,
    saved_at = excluded.saved_at;
end;
$$;

create function public.submit_quiz_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_closes_at timestamptz;
begin
  select * into v_attempt from public.quiz_attempts
  where id = p_attempt_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'No puedes enviar este intento.';
  end if;

  select closes_at into v_closes_at from public.quizzes where id = v_attempt.quiz_id;

  -- Idempotent: a second submit just returns the stored result.
  if v_attempt.status = 'started'::public.quiz_attempt_status then
    perform private.finalize_attempt(
      v_attempt.id,
      pg_catalog.statement_timestamp() < least(v_attempt.deadline_at, v_closes_at)
    );
  end if;

  return public.get_quiz_result(v_attempt.quiz_id);
end;
$$;

-- Score always after finalizing (unless hidden); solutions only after close.
create function public.get_quiz_result(p_quiz_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_attempt public.quiz_attempts;
  v_quiz public.quizzes;
  v_show_score boolean;
  v_show_solutions boolean;
begin
  perform private.finalize_expired_attempts((select auth.uid()), p_quiz_id);

  select * into v_attempt from public.quiz_attempts
  where quiz_id = p_quiz_id and user_id = (select auth.uid());

  if not found then
    return null;
  end if;

  select * into v_quiz from public.quizzes where id = p_quiz_id;

  v_show_score := v_quiz.results_visibility <> 'none'::public.quiz_results_visibility
    and v_attempt.status <> 'started'::public.quiz_attempt_status;
  v_show_solutions := v_quiz.results_visibility = 'score_and_solutions_after_close'::public.quiz_results_visibility
    and pg_catalog.statement_timestamp() >= v_quiz.closes_at
    and v_attempt.status <> 'started'::public.quiz_attempt_status;

  return pg_catalog.jsonb_build_object(
    'status', v_attempt.status,
    'finalized_late', v_attempt.finalized_late,
    'closes_at', v_quiz.closes_at,
    'score', case when v_show_score then v_attempt.auto_score + v_attempt.review_score + v_attempt.bonus_score end,
    'auto_score', case when v_show_score then v_attempt.auto_score end,
    'review_score', case when v_show_score then v_attempt.review_score end,
    'bonus_score', case when v_show_score then v_attempt.bonus_score end,
    'correct_count', case when v_show_score then v_attempt.correct_count end,
    'solutions_available', v_show_solutions,
    'solutions', case when v_show_solutions then (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'prompt', questions.prompt,
          'type', questions.type,
          'points', questions.points,
          'your_option', (select options.label from public.quiz_options as options where options.id = answers.selected_option_id),
          'your_text', answers.text_answer,
          'correct_option', (select options.label from public.quiz_options as options where options.id = keys.correct_option_id),
          'is_correct', answers.selected_option_id is not null and answers.selected_option_id = keys.correct_option_id,
          'review_status', answers.review_status,
          'review_points', answers.review_points,
          'explanation', keys.explanation
        )
        order by pg_catalog.array_position(v_attempt.question_order, questions.id)
      )
      from public.quiz_questions as questions
      left join private.quiz_answer_keys as keys on keys.question_id = questions.id
      left join public.quiz_answers as answers
        on answers.attempt_id = v_attempt.id and answers.question_id = questions.id
      where questions.quiz_id = v_quiz.id
    ) end
  );
end;
$$;

-- Landing: upcoming and active quizzes, titles and dates only.
create function public.get_public_quizzes()
returns table (title text, opens_at timestamptz, closes_at timestamptz, phase text)
language sql
stable
security definer
set search_path = ''
as $$
  select quizzes.title, quizzes.opens_at, quizzes.closes_at, private.quiz_phase(quizzes)
  from public.quizzes as quizzes
  where quizzes.campaign_id = private.current_campaign_id()
    and quizzes.status = 'scheduled'::public.quiz_status
    and quizzes.closes_at > pg_catalog.statement_timestamp()
  order by quizzes.opens_at
  limit 6;
$$;

revoke all on function public.list_my_quizzes() from public, anon;
revoke all on function public.start_quiz_attempt(uuid) from public, anon;
revoke all on function public.save_quiz_answer(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
revoke all on function public.get_quiz_result(uuid) from public, anon;
revoke all on function public.get_public_quizzes() from public;
grant execute on function public.list_my_quizzes() to authenticated;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.save_quiz_answer(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
grant execute on function public.get_quiz_result(uuid) to authenticated;
grant execute on function public.get_public_quizzes() to anon, authenticated;

-- ===========================================================================
-- Administrative RPCs
-- ===========================================================================

-- Creates (p_quiz_id null) or replaces a quiz from the editor payload. Once
-- locked, only title, description, closing time and visibility can change.
create function public.admin_save_quiz(p_quiz_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
  v_before jsonb;
  v_question jsonb;
  v_option jsonb;
  v_question_id uuid;
  v_option_id uuid;
  v_correct_id uuid;
  v_question_index integer;
  v_option_index integer;
  v_correct_count integer;
  v_campaign_id uuid;
begin
  perform private.require_role('admin', 'superadmin');

  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_payload -> 'questions') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_payload -> 'questions') > 100 then
    raise exception using errcode = '22023', message = 'El cuestionario no es válido.';
  end if;

  if p_quiz_id is null then
    v_campaign_id := private.current_campaign_id();

    if v_campaign_id is null then
      raise exception using errcode = '55000', message = 'Crea y publica una campaña antes de crear cuestionarios.';
    end if;

    insert into public.quizzes (campaign_id, title, opens_at, closes_at, duration_seconds, created_by, updated_by)
    values (
      v_campaign_id,
      p_payload ->> 'title',
      (p_payload ->> 'opens_at')::timestamptz,
      (p_payload ->> 'closes_at')::timestamptz,
      (p_payload ->> 'duration_seconds')::integer,
      (select auth.uid()),
      (select auth.uid())
    )
    returning * into v_quiz;
  else
    select * into v_quiz from public.quizzes where id = p_quiz_id for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'El cuestionario no existe.';
    end if;

    if v_quiz.status = 'archived'::public.quiz_status then
      raise exception using errcode = '55000', message = 'Un cuestionario archivado no se puede editar.';
    end if;
  end if;

  v_before := pg_catalog.to_jsonb(v_quiz);

  if v_quiz.locked_at is not null then
    update public.quizzes
    set
      title = p_payload ->> 'title',
      description = coalesce(p_payload ->> 'description', ''),
      closes_at = (p_payload ->> 'closes_at')::timestamptz,
      results_visibility = (p_payload ->> 'results_visibility')::public.quiz_results_visibility,
      updated_by = (select auth.uid())
    where id = v_quiz.id;
  else
    update public.quizzes
    set
      title = p_payload ->> 'title',
      description = coalesce(p_payload ->> 'description', ''),
      opens_at = (p_payload ->> 'opens_at')::timestamptz,
      closes_at = (p_payload ->> 'closes_at')::timestamptz,
      duration_seconds = (p_payload ->> 'duration_seconds')::integer,
      shuffle_questions = coalesce((p_payload ->> 'shuffle_questions')::boolean, false),
      shuffle_options = coalesce((p_payload ->> 'shuffle_options')::boolean, false),
      results_visibility = (p_payload ->> 'results_visibility')::public.quiz_results_visibility,
      speed_bonus_enabled = coalesce((p_payload ->> 'speed_bonus_enabled')::boolean, false),
      speed_bonus_max = coalesce((p_payload ->> 'speed_bonus_max')::integer, 0),
      speed_bonus_min = coalesce((p_payload ->> 'speed_bonus_min')::integer, 0),
      speed_fast_threshold_seconds = coalesce((p_payload ->> 'speed_fast_threshold_seconds')::integer, 0),
      speed_window_seconds = coalesce((p_payload ->> 'speed_window_seconds')::integer, 60),
      updated_by = (select auth.uid())
    where id = v_quiz.id;

    delete from public.quiz_questions where quiz_id = v_quiz.id;

    for v_question, v_question_index in
      select value, ordinality from pg_catalog.jsonb_array_elements(p_payload -> 'questions') with ordinality
    loop
      insert into public.quiz_questions (quiz_id, position, type, prompt, points, max_chars)
      values (
        v_quiz.id,
        v_question_index,
        (v_question ->> 'type')::public.quiz_question_type,
        pg_catalog.btrim(v_question ->> 'prompt'),
        (v_question ->> 'points')::integer,
        case when v_question ->> 'type' = 'open_text' then (v_question ->> 'max_chars')::integer end
      )
      returning id into v_question_id;

      v_correct_id := null;
      v_correct_count := 0;

      if v_question ->> 'type' = 'multiple_choice' then
        if pg_catalog.jsonb_array_length(coalesce(v_question -> 'options', '[]'::jsonb)) > 10 then
          raise exception using errcode = '22023', message = 'Máximo 10 opciones por pregunta.';
        end if;

        for v_option, v_option_index in
          select value, ordinality from pg_catalog.jsonb_array_elements(coalesce(v_question -> 'options', '[]'::jsonb)) with ordinality
        loop
          insert into public.quiz_options (question_id, position, label)
          values (v_question_id, v_option_index, pg_catalog.btrim(v_option ->> 'label'))
          returning id into v_option_id;

          if coalesce((v_option ->> 'correct')::boolean, false) then
            v_correct_id := v_option_id;
            v_correct_count := v_correct_count + 1;
          end if;
        end loop;

        if v_correct_count > 1 then
          raise exception using errcode = '22023', message = 'Marca solo una respuesta correcta por pregunta.';
        end if;
      end if;

      insert into private.quiz_answer_keys (question_id, correct_option_id, explanation)
      values (v_question_id, v_correct_id, coalesce(pg_catalog.btrim(v_question ->> 'explanation'), ''));
    end loop;

    if v_quiz.status = 'scheduled'::public.quiz_status then
      perform private.validate_quiz(v_quiz.id);
    end if;
  end if;

  perform private.write_audit(
    case when p_quiz_id is null then 'quiz.create' else 'quiz.save' end,
    'quiz', v_quiz.id::text, v_quiz.campaign_id, v_before,
    pg_catalog.jsonb_build_object('title', p_payload ->> 'title', 'locked', v_quiz.locked_at is not null)
  );

  return v_quiz.id;
end;
$$;

create function public.admin_set_quiz_status(p_quiz_id uuid, p_status public.quiz_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz public.quizzes;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_quiz from public.quizzes where id = p_quiz_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'El cuestionario no existe.';
  end if;

  if not (v_quiz.status, p_status) in (
    ('draft'::public.quiz_status, 'scheduled'::public.quiz_status),
    ('scheduled'::public.quiz_status, 'draft'::public.quiz_status),
    ('scheduled'::public.quiz_status, 'closed'::public.quiz_status),
    ('draft'::public.quiz_status, 'archived'::public.quiz_status),
    ('closed'::public.quiz_status, 'archived'::public.quiz_status)
  ) then
    raise exception using errcode = '22023', message = 'Ese cambio de estado no está permitido.';
  end if;

  if p_status = 'scheduled'::public.quiz_status then
    perform private.validate_quiz(p_quiz_id);

    if v_quiz.closes_at <= pg_catalog.statement_timestamp() then
      raise exception using errcode = '22023', message = 'El cierre debe estar en el futuro.';
    end if;
  end if;

  if p_status = 'draft'::public.quiz_status and v_quiz.locked_at is not null then
    raise exception using errcode = '55000', message = 'Ya hay participaciones: ciérralo en lugar de volver a borrador.';
  end if;

  if p_status = 'closed'::public.quiz_status then
    update public.quizzes
    set status = p_status, closes_at = least(closes_at, pg_catalog.statement_timestamp()), updated_by = (select auth.uid())
    where id = p_quiz_id;

    perform private.finalize_expired_attempts(null, p_quiz_id);
  else
    update public.quizzes set status = p_status, updated_by = (select auth.uid()) where id = p_quiz_id;
  end if;

  perform private.write_audit(
    'quiz.status', 'quiz', p_quiz_id::text, v_quiz.campaign_id,
    pg_catalog.jsonb_build_object('status', v_quiz.status),
    pg_catalog.jsonb_build_object('status', p_status)
  );
end;
$$;

create function public.admin_duplicate_quiz(p_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.quizzes;
  v_new_id uuid;
  v_question public.quiz_questions;
  v_new_question_id uuid;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_source from public.quizzes where id = p_quiz_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'El cuestionario no existe.';
  end if;

  insert into public.quizzes (
    campaign_id, title, description, opens_at, closes_at, duration_seconds, shuffle_questions,
    shuffle_options, results_visibility, speed_bonus_enabled, speed_bonus_max, speed_bonus_min,
    speed_fast_threshold_seconds, speed_window_seconds, created_by, updated_by
  )
  values (
    v_source.campaign_id, pg_catalog.left(v_source.title || ' (copia)', 120), v_source.description,
    v_source.opens_at, v_source.closes_at, v_source.duration_seconds, v_source.shuffle_questions,
    v_source.shuffle_options, v_source.results_visibility, v_source.speed_bonus_enabled,
    v_source.speed_bonus_max, v_source.speed_bonus_min, v_source.speed_fast_threshold_seconds,
    v_source.speed_window_seconds, (select auth.uid()), (select auth.uid())
  )
  returning id into v_new_id;

  for v_question in select * from public.quiz_questions where quiz_id = p_quiz_id order by position loop
    insert into public.quiz_questions (quiz_id, position, type, prompt, points, max_chars)
    values (v_new_id, v_question.position, v_question.type, v_question.prompt, v_question.points, v_question.max_chars)
    returning id into v_new_question_id;

    insert into public.quiz_options (question_id, position, label)
    select v_new_question_id, options.position, options.label
    from public.quiz_options as options where options.question_id = v_question.id;

    insert into private.quiz_answer_keys (question_id, correct_option_id, explanation)
    select
      v_new_question_id,
      (
        select new_options.id from public.quiz_options as new_options
        join public.quiz_options as old_options on old_options.position = new_options.position
        where new_options.question_id = v_new_question_id and old_options.id = keys.correct_option_id
      ),
      keys.explanation
    from private.quiz_answer_keys as keys where keys.question_id = v_question.id;
  end loop;

  perform private.write_audit(
    'quiz.duplicate', 'quiz', v_new_id::text, v_source.campaign_id,
    pg_catalog.jsonb_build_object('source', p_quiz_id), pg_catalog.jsonb_build_object('id', v_new_id)
  );

  return v_new_id;
end;
$$;

-- Full quiz for the editor, including the private answer keys.
create function public.admin_get_quiz(p_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return (
    select pg_catalog.to_jsonb(quizzes) || pg_catalog.jsonb_build_object(
      'attempt_count', (select count(*) from public.quiz_attempts as attempts where attempts.quiz_id = quizzes.id),
      'pending_reviews', (
        select count(*) from public.quiz_answers as answers
        join public.quiz_attempts as attempts on attempts.id = answers.attempt_id
        where attempts.quiz_id = quizzes.id and answers.review_status = 'pending'::public.quiz_review_status
      ),
      'questions', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', questions.id,
            'type', questions.type,
            'prompt', questions.prompt,
            'points', questions.points,
            'max_chars', questions.max_chars,
            'explanation', keys.explanation,
            'options', coalesce((
              select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'id', options.id, 'label', options.label, 'correct', options.id = keys.correct_option_id
                )
                order by options.position
              )
              from public.quiz_options as options where options.question_id = questions.id
            ), '[]'::jsonb)
          )
          order by questions.position
        )
        from public.quiz_questions as questions
        left join private.quiz_answer_keys as keys on keys.question_id = questions.id
        where questions.quiz_id = quizzes.id
      ), '[]'::jsonb)
    )
    from public.quizzes as quizzes
    where quizzes.id = p_quiz_id
  );
end;
$$;

create function public.admin_review_queue()
returns table (
  attempt_id uuid,
  question_id uuid,
  quiz_title text,
  prompt text,
  max_points integer,
  text_answer text,
  alias text,
  passport_code text,
  submitted_at timestamptz,
  review_status public.quiz_review_status,
  review_points integer,
  review_note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return query
  select
    answers.attempt_id,
    answers.question_id,
    quizzes.title,
    questions.prompt,
    questions.points,
    answers.text_answer,
    profiles.alias,
    profiles.passport_code,
    attempts.submitted_at,
    answers.review_status,
    answers.review_points,
    answers.review_note
  from public.quiz_answers as answers
  join public.quiz_attempts as attempts on attempts.id = answers.attempt_id
  join public.quizzes as quizzes on quizzes.id = attempts.quiz_id
  join public.quiz_questions as questions on questions.id = answers.question_id
  join public.profiles as profiles on profiles.id = attempts.user_id
  where answers.review_status is not null
    and attempts.campaign_id = private.current_campaign_id()
  order by (answers.review_status = 'pending'::public.quiz_review_status) desc, attempts.submitted_at
  limit 300;
end;
$$;

-- A changed decision reverses the previous award and grants a new one.
create function public.admin_review_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_points integer,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer public.quiz_answers;
  v_attempt public.quiz_attempts;
  v_question public.quiz_questions;
  v_quiz_title text;
  v_previous_event_id bigint;
  v_revision integer;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_answer from public.quiz_answers
  where attempt_id = p_attempt_id and question_id = p_question_id
  for update;

  if not found or v_answer.review_status is null then
    raise exception using errcode = 'P0002', message = 'Esta respuesta no requiere revisión.';
  end if;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id for update;
  select * into v_question from public.quiz_questions where id = p_question_id;
  select title into v_quiz_title from public.quizzes where id = v_attempt.quiz_id;

  if p_points is null or p_points < 0 or p_points > v_question.points then
    raise exception using errcode = '22023', message = 'La puntuación debe estar entre 0 y el máximo de la pregunta.';
  end if;

  if v_answer.review_status <> 'pending'::public.quiz_review_status and coalesce(v_answer.review_points, 0) > 0 then
    select events.id into v_previous_event_id
    from public.point_events as events
    where events.kind = 'open_review'::public.point_event_kind
      and events.source_type = 'quiz_review'
      and events.source_id = p_attempt_id::text || ':' || p_question_id::text || ':' || v_answer.review_revision
      and not exists (select 1 from public.point_events as reversal where reversal.reverses_event_id = events.id);

    if v_previous_event_id is not null then
      perform public.admin_reverse_point_event(v_previous_event_id, 'Cambio de decisión en la revisión de una respuesta abierta');
    end if;
  end if;

  v_revision := v_answer.review_revision + 1;

  if p_points > 0 then
    perform private.award_points(
      v_attempt.campaign_id, v_attempt.user_id, p_points, 'open_review'::public.point_event_kind,
      'quiz_review', p_attempt_id::text || ':' || p_question_id::text || ':' || v_revision,
      pg_catalog.left('Respuesta abierta: ' || v_quiz_title, 200),
      case when p_points = v_question.points then 1 else 0 end,
      false
    );
  end if;

  update public.quiz_answers
  set
    review_status = case
      when p_points = 0 then 'rejected'::public.quiz_review_status
      when p_points = v_question.points then 'approved'::public.quiz_review_status
      else 'partial'::public.quiz_review_status
    end,
    review_points = p_points,
    review_note = nullif(pg_catalog.btrim(p_note), ''),
    review_revision = v_revision,
    reviewed_by = (select auth.uid()),
    reviewed_at = pg_catalog.statement_timestamp()
  where attempt_id = p_attempt_id and question_id = p_question_id;

  update public.quiz_attempts
  set
    review_score = (select coalesce(sum(review_points), 0) from public.quiz_answers where attempt_id = p_attempt_id),
    status = case
      when exists (
        select 1 from public.quiz_answers
        where attempt_id = p_attempt_id and review_status = 'pending'::public.quiz_review_status
      ) then status
      else 'scored'::public.quiz_attempt_status
    end
  where id = p_attempt_id;

  perform private.write_audit(
    'review.decide', 'quiz_answer', p_attempt_id::text || ':' || p_question_id::text, v_attempt.campaign_id,
    pg_catalog.jsonb_build_object('status', v_answer.review_status, 'points', v_answer.review_points),
    pg_catalog.jsonb_build_object('points', p_points),
    nullif(pg_catalog.btrim(p_note), '')
  );
end;
$$;

revoke all on function public.admin_save_quiz(uuid, jsonb) from public, anon;
revoke all on function public.admin_set_quiz_status(uuid, public.quiz_status) from public, anon;
revoke all on function public.admin_duplicate_quiz(uuid) from public, anon;
revoke all on function public.admin_get_quiz(uuid) from public, anon;
revoke all on function public.admin_review_queue() from public, anon;
revoke all on function public.admin_review_answer(uuid, uuid, integer, text) from public, anon;
grant execute on function public.admin_save_quiz(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_quiz_status(uuid, public.quiz_status) to authenticated;
grant execute on function public.admin_duplicate_quiz(uuid) to authenticated;
grant execute on function public.admin_get_quiz(uuid) to authenticated;
grant execute on function public.admin_review_queue() to authenticated;
grant execute on function public.admin_review_answer(uuid, uuid, integer, text) to authenticated;

-- ===========================================================================
-- Ranking is provisional while open answers await review
-- ===========================================================================

create or replace function public.get_ranking_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'visible', campaigns.ranking_visible,
    'audience', campaigns.ranking_audience,
    'highlight_top', campaigns.ranking_highlight_top,
    'provisional', exists (
      select 1
      from public.quiz_answers as answers
      join public.quiz_attempts as attempts on attempts.id = answers.attempt_id
      where attempts.campaign_id = campaigns.id
        and answers.review_status = 'pending'::public.quiz_review_status
    )
  )
  from public.campaigns as campaigns
  where campaigns.id = private.current_campaign_id();
$$;

commit;
