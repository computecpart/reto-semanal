begin;

-- Restores the quoted tg_op literal lost when 20261022000000 was written.
create or replace function private.guard_locked_quiz()
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
    v_quiz_id := case when tg_op = 'DELETE' then old.quiz_id else new.quiz_id end;
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

commit;
