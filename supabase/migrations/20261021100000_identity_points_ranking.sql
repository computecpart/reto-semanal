begin;

-- ===========================================================================
-- Participant identity: phone, separate marketing consent, passport code
-- ===========================================================================

-- 8 characters from a 32-symbol alphabet without ambiguous glyphs (0/O, 1/I).
-- 256 is a multiple of 32, so the byte-modulo mapping has no bias.
create function private.new_passport_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || pg_catalog.substr(v_alphabet, (pg_catalog.get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;

  return pg_catalog.substr(v_code, 1, 4) || '-' || pg_catalog.substr(v_code, 5, 4);
end;
$$;

revoke all on function private.new_passport_code() from public, anon, authenticated;

alter table public.profiles
  add column phone text,
  add column marketing_consent_at timestamptz,
  add column passport_code text;

alter table public.profiles
  add constraint profiles_phone_valid check (phone is null or phone ~ '^\+503[267][0-9]{7}$'),
  add constraint profiles_passport_code_valid check (
    passport_code ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'
  );

update public.profiles
set passport_code = private.new_passport_code()
where passport_code is null;

alter table public.profiles
  alter column passport_code set default private.new_passport_code(),
  alter column passport_code set not null,
  add constraint profiles_passport_code_unique unique (passport_code);

comment on column public.profiles.passport_code is
  'Identificador MSI Passport del participante. Se muestra parcialmente en el ranking.';

-- Phone and marketing consent are the only contact fields users change.
create function public.update_my_contact(p_phone text, p_marketing_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Se requiere una sesión autenticada.';
  end if;

  if p_phone is null or p_phone !~ '^\+503[267][0-9]{7}$' then
    raise exception using
      errcode = '22023',
      message = 'El teléfono no es válido.';
  end if;

  update public.profiles
  set
    phone = p_phone,
    marketing_consent_at = case
      when coalesce(p_marketing_consent, false) then coalesce(marketing_consent_at, pg_catalog.statement_timestamp())
      else null
    end
  where id = (select auth.uid());

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'No encontramos un perfil válido para tu sesión.';
  end if;
end;
$$;

revoke all on function public.update_my_contact(text, boolean) from public, anon;
grant execute on function public.update_my_contact(text, boolean) to authenticated;

-- ===========================================================================
-- Participant status (moderation UI arrives in a later phase)
-- ===========================================================================

create type public.participant_status as enum ('active', 'suspended', 'disqualified', 'archived');

revoke all on type public.participant_status from public, anon;
grant usage on type public.participant_status to authenticated;

create table private.participant_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status public.participant_status not null default 'active',
  reason text check (reason is null or char_length(reason) <= 500),
  changed_at timestamptz not null default now(),
  changed_by uuid
);

alter table private.participant_states enable row level security;
revoke all on table private.participant_states from public, anon, authenticated;

insert into private.participant_states (user_id)
select users.id from auth.users as users
on conflict (user_id) do nothing;

create function private.participant_can_earn(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.participant_states as states
    where states.user_id = p_user_id
      and states.status = 'active'::public.participant_status
  );
$$;

-- Only the participant role competes; staff accounts never rank or earn.
create function private.is_competitor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles as roles
    where roles.user_id = p_user_id
      and roles.role = 'participant'::public.app_role
  );
$$;

revoke all on function private.participant_can_earn(uuid) from public, anon, authenticated;
revoke all on function private.is_competitor(uuid) from public, anon, authenticated;

create function public.get_my_participant_status()
returns public.participant_status
language sql
stable
security definer
set search_path = ''
as $$
  select states.status
  from private.participant_states as states
  where states.user_id = (select auth.uid());
$$;

revoke all on function public.get_my_participant_status() from public, anon;
grant execute on function public.get_my_participant_status() to authenticated;

-- ===========================================================================
-- Point ledger: append-only source of truth
-- ===========================================================================

create type public.point_event_kind as enum (
  'quiz',
  'quiz_speed_bonus',
  'open_review',
  'mission',
  'adjustment',
  'correction'
);

revoke all on type public.point_event_kind from public, anon;
grant usage on type public.point_event_kind to authenticated;

create table public.point_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  amount integer not null check (amount <> 0 and abs(amount) <= 100000),
  kind public.point_event_kind not null,
  source_type text check (source_type is null or source_type ~ '^[a-z_]{1,40}$'),
  source_id text check (source_id is null or char_length(source_id) between 1 and 100),
  -- Tie-break statistics (rules 7): correct answers and completed activities.
  correct_answers integer not null default 0 check (correct_answers between 0 and 1000),
  counts_as_event boolean not null default false,
  description text not null check (char_length(description) between 1 and 200),
  reason text check (reason is null or char_length(reason) <= 500),
  actor_id uuid,
  reverses_event_id bigint references public.point_events (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint point_events_source_pair check ((source_type is null) = (source_id is null)),
  constraint point_events_correction_shape check (
    (kind = 'correction'::public.point_event_kind) = (reverses_event_id is not null)
  )
);

comment on table public.point_events is
  'Ledger oficial de puntos. Solo inserción; las correcciones son movimientos compensatorios.';

-- The same activity can score only once per participant and kind.
create unique index point_events_source_once
on public.point_events (campaign_id, user_id, kind, source_type, source_id)
where source_id is not null;

-- An event can be reversed only once.
create unique index point_events_reversed_once
on public.point_events (reverses_event_id)
where reverses_event_id is not null;

create index point_events_campaign_user on public.point_events (campaign_id, user_id);

alter table public.point_events enable row level security;
revoke all on table public.point_events from public, anon, authenticated;
revoke all on sequence public.point_events_id_seq from public, anon, authenticated;
grant select on table public.point_events to authenticated;

create policy "point_events_select_own"
on public.point_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "point_events_admin_read"
on public.point_events
for select
to authenticated
using ((select public.is_admin()));

create trigger point_events_append_only
before update or delete on public.point_events
for each row execute function private.forbid_mutation();

create trigger point_events_no_truncate
before truncate on public.point_events
for each statement execute function private.forbid_mutation();

-- Single entry point for automatic scoring (quizzes, missions). Callers run
-- it inside their own transaction; it never trusts client-supplied amounts.
create function private.award_points(
  p_campaign_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_kind public.point_event_kind,
  p_source_type text,
  p_source_id text,
  p_description text,
  p_correct_answers integer default 0,
  p_counts_as_event boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if p_kind in ('adjustment'::public.point_event_kind, 'correction'::public.point_event_kind) then
    raise exception using errcode = '22023', message = 'Tipo de movimiento no permitido.';
  end if;

  if p_source_id is null then
    raise exception using errcode = '22023', message = 'El movimiento necesita un origen.';
  end if;

  if not exists (
    select 1
    from public.campaigns as campaigns
    where campaigns.id = p_campaign_id
      and campaigns.status = 'published'::public.campaign_status
      and pg_catalog.statement_timestamp() >= campaigns.starts_at
      and pg_catalog.statement_timestamp() < campaigns.ends_at
  ) then
    raise exception using errcode = '55000', message = 'La campaña no está recibiendo puntuaciones.';
  end if;

  if not private.is_competitor(p_user_id) or not private.participant_can_earn(p_user_id) then
    raise exception using errcode = '42501', message = 'Tu cuenta no puede sumar puntos.';
  end if;

  insert into public.point_events (
    campaign_id, user_id, amount, kind, source_type, source_id, description,
    correct_answers, counts_as_event, actor_id
  )
  values (
    p_campaign_id, p_user_id, p_amount, p_kind, p_source_type, p_source_id, p_description,
    coalesce(p_correct_answers, 0), coalesce(p_counts_as_event, true), (select auth.uid())
  )
  on conflict (campaign_id, user_id, kind, source_type, source_id)
    where source_id is not null
  do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke all on function private.award_points(uuid, uuid, integer, public.point_event_kind, text, text, text, integer, boolean)
from public, anon, authenticated;

-- ===========================================================================
-- Ranking configuration
-- ===========================================================================

alter table public.campaigns
  add column ranking_visible boolean not null default false,
  add column ranking_audience text not null default 'authenticated'
    check (ranking_audience in ('public', 'authenticated')),
  add column ranking_identity text not null default 'alias_passport'
    check (ranking_identity in ('alias', 'alias_passport', 'alias_name', 'name')),
  add column ranking_highlight_top integer not null default 5
    check (ranking_highlight_top between 0 and 20);

-- Per-participant standing for a campaign. Corrections are summed into
-- points, while the statistics of reversed events stop counting.
create function private.campaign_standings(p_campaign_id uuid)
returns table (
  user_id uuid,
  points bigint,
  correct_answers bigint,
  events_completed bigint,
  standing bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with competitors as (
    select roles.user_id
    from private.user_roles as roles
    join private.participant_states as states on states.user_id = roles.user_id
    join public.profiles as profiles on profiles.id = roles.user_id
    where roles.role = 'participant'::public.app_role
      and states.status in ('active'::public.participant_status, 'suspended'::public.participant_status)
      and profiles.profile_completed_at is not null
  ),
  events as (
    select
      events.*,
      exists (
        select 1 from public.point_events as reversal
        where reversal.reverses_event_id = events.id
      ) as is_reversed
    from public.point_events as events
    where events.campaign_id = p_campaign_id
  ),
  totals as (
    select
      competitors.user_id,
      coalesce(sum(events.amount), 0)::bigint as points,
      coalesce(sum(events.correct_answers) filter (where not events.is_reversed), 0)::bigint as correct_answers,
      count(distinct (events.source_type, events.source_id))
        filter (where events.counts_as_event and not events.is_reversed)::bigint as events_completed
    from competitors
    left join events on events.user_id = competitors.user_id
    group by competitors.user_id
  )
  select
    totals.user_id,
    totals.points,
    totals.correct_answers,
    totals.events_completed,
    pg_catalog.rank() over (
      order by totals.points desc, totals.correct_answers desc, totals.events_completed desc
    ) as standing
  from totals;
$$;

revoke all on function private.campaign_standings(uuid) from public, anon, authenticated;

-- Public ranking: exposes only the identity the campaign allows. Email,
-- birth date, age and department are never returned.
create function public.get_ranking(p_limit integer default 500)
returns table (
  standing bigint,
  avatar_id text,
  alias text,
  display_name text,
  passport_hint text,
  points bigint,
  correct_answers bigint,
  events_completed bigint,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with campaign as (
    select campaigns.*
    from public.campaigns as campaigns
    where campaigns.id = private.current_campaign_id()
      and campaigns.ranking_visible
      and (campaigns.ranking_audience = 'public' or (select auth.uid()) is not null)
  )
  select
    standings.standing,
    profiles.avatar_id,
    case when campaign.ranking_identity in ('alias', 'alias_passport', 'alias_name') then profiles.alias end,
    case when campaign.ranking_identity in ('name', 'alias_name')
      then profiles.first_name || ' ' || pg_catalog.left(profiles.last_name, 1) || '.' end,
    case when campaign.ranking_identity = 'alias_passport'
      then '••••-' || pg_catalog.right(profiles.passport_code, 4) end,
    standings.points,
    standings.correct_answers,
    standings.events_completed,
    standings.user_id = (select auth.uid())
  from campaign
  cross join lateral private.campaign_standings(campaign.id) as standings
  join public.profiles as profiles on profiles.id = standings.user_id
  order by standings.standing, profiles.alias
  limit least(greatest(coalesce(p_limit, 500), 1), 500);
$$;

revoke all on function public.get_ranking(integer) from public;
grant execute on function public.get_ranking(integer) to anon, authenticated;

create function public.get_ranking_settings()
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
    -- Open-answer reviews (next phase) will make the ranking provisional.
    'provisional', false
  )
  from public.campaigns as campaigns
  where campaigns.id = private.current_campaign_id();
$$;

revoke all on function public.get_ranking_settings() from public;
grant execute on function public.get_ranking_settings() to anon, authenticated;

create function public.get_my_points()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'total', coalesce((
      select sum(events.amount) from public.point_events as events
      where events.user_id = (select auth.uid()) and events.campaign_id = private.current_campaign_id()
    ), 0),
    'standing', (
      select standings.standing
      from private.campaign_standings(private.current_campaign_id()) as standings
      where standings.user_id = (select auth.uid())
    ),
    'events', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', events.id,
          'amount', events.amount,
          'kind', events.kind,
          'description', events.description,
          'created_at', events.created_at
        )
        order by events.created_at desc, events.id desc
      )
      from public.point_events as events
      where events.user_id = (select auth.uid()) and events.campaign_id = private.current_campaign_id()
    ), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

revoke all on function public.get_my_points() from public, anon;
grant execute on function public.get_my_points() to authenticated;

-- ===========================================================================
-- Administrative RPCs
-- ===========================================================================

create function public.admin_update_ranking_settings(
  p_campaign_id uuid,
  p_visible boolean,
  p_audience text,
  p_identity text,
  p_highlight_top integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.campaigns;
  v_after public.campaigns;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_before from public.campaigns where id = p_campaign_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  update public.campaigns
  set
    ranking_visible = coalesce(p_visible, false),
    ranking_audience = p_audience,
    ranking_identity = p_identity,
    ranking_highlight_top = p_highlight_top,
    updated_by = (select auth.uid())
  where id = p_campaign_id
  returning * into v_after;

  perform private.write_audit(
    'ranking.settings', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object(
      'visible', v_before.ranking_visible, 'audience', v_before.ranking_audience,
      'identity', v_before.ranking_identity, 'highlight_top', v_before.ranking_highlight_top
    ),
    pg_catalog.jsonb_build_object(
      'visible', v_after.ranking_visible, 'audience', v_after.ranking_audience,
      'identity', v_after.ranking_identity, 'highlight_top', v_after.ranking_highlight_top
    )
  );
end;
$$;

create function public.admin_adjust_points(
  p_campaign_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id bigint;
begin
  perform private.require_role('admin', 'superadmin');

  perform 1 from public.campaigns where id = p_campaign_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  if not private.is_competitor(p_user_id) then
    raise exception using errcode = '42501', message = 'Solo se ajustan puntos de participantes.';
  end if;

  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then
    raise exception using errcode = '22023', message = 'El ajuste no es válido.';
  end if;

  if char_length(coalesce(pg_catalog.btrim(p_reason), '')) < 10 then
    raise exception using errcode = '22023', message = 'Describe el motivo con al menos 10 caracteres.';
  end if;

  insert into public.point_events (
    campaign_id, user_id, amount, kind, description, reason, actor_id
  )
  values (
    p_campaign_id,
    p_user_id,
    p_amount,
    'adjustment'::public.point_event_kind,
    coalesce(nullif(pg_catalog.btrim(p_description), ''), 'Ajuste administrativo'),
    pg_catalog.btrim(p_reason),
    (select auth.uid())
  )
  returning id into v_event_id;

  perform private.write_audit(
    'points.adjust', 'point_event', v_event_id::text, p_campaign_id, null,
    pg_catalog.jsonb_build_object('user_id', p_user_id, 'amount', p_amount),
    pg_catalog.btrim(p_reason)
  );

  return v_event_id;
end;
$$;

create function public.admin_reverse_point_event(p_event_id bigint, p_reason text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.point_events;
  v_correction_id bigint;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_event from public.point_events where id = p_event_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'El movimiento no existe.';
  end if;

  if v_event.kind = 'correction'::public.point_event_kind then
    raise exception using errcode = '22023', message = 'Una corrección no se puede revertir.';
  end if;

  if exists (select 1 from public.point_events where reverses_event_id = p_event_id) then
    raise exception using errcode = '23505', message = 'Ese movimiento ya fue revertido.';
  end if;

  if char_length(coalesce(pg_catalog.btrim(p_reason), '')) < 10 then
    raise exception using errcode = '22023', message = 'Describe el motivo con al menos 10 caracteres.';
  end if;

  insert into public.point_events (
    campaign_id, user_id, amount, kind, description, reason, actor_id, reverses_event_id
  )
  values (
    v_event.campaign_id,
    v_event.user_id,
    -v_event.amount,
    'correction'::public.point_event_kind,
    pg_catalog.left('Corrección: ' || v_event.description, 200),
    pg_catalog.btrim(p_reason),
    (select auth.uid()),
    v_event.id
  )
  returning id into v_correction_id;

  perform private.write_audit(
    'points.reverse', 'point_event', v_correction_id::text, v_event.campaign_id,
    pg_catalog.jsonb_build_object('event_id', v_event.id, 'amount', v_event.amount),
    pg_catalog.jsonb_build_object('event_id', v_correction_id, 'amount', -v_event.amount),
    pg_catalog.btrim(p_reason)
  );

  return v_correction_id;
end;
$$;

-- Full standings for staff (identity + tie-break statistics + status).
create function public.admin_get_standings(p_campaign_id uuid)
returns table (
  user_id uuid,
  standing bigint,
  alias text,
  full_name text,
  passport_code text,
  avatar_id text,
  status public.participant_status,
  points bigint,
  correct_answers bigint,
  events_completed bigint
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
    standings.user_id,
    standings.standing,
    profiles.alias,
    profiles.first_name || ' ' || profiles.last_name,
    profiles.passport_code,
    profiles.avatar_id,
    states.status,
    standings.points,
    standings.correct_answers,
    standings.events_completed
  from private.campaign_standings(p_campaign_id) as standings
  join public.profiles as profiles on profiles.id = standings.user_id
  join private.participant_states as states on states.user_id = standings.user_id
  order by standings.standing, profiles.alias;
end;
$$;

create function public.admin_recent_point_events(p_campaign_id uuid, p_limit integer default 50)
returns table (
  id bigint,
  created_at timestamptz,
  alias text,
  amount integer,
  kind public.point_event_kind,
  description text,
  reason text,
  is_reversed boolean
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
    events.id,
    events.created_at,
    profiles.alias,
    events.amount,
    events.kind,
    events.description,
    events.reason,
    exists (select 1 from public.point_events as reversal where reversal.reverses_event_id = events.id)
  from public.point_events as events
  join public.profiles as profiles on profiles.id = events.user_id
  where events.campaign_id = p_campaign_id
  order by events.created_at desc, events.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.admin_update_ranking_settings(uuid, boolean, text, text, integer) from public, anon;
revoke all on function public.admin_adjust_points(uuid, uuid, integer, text, text) from public, anon;
revoke all on function public.admin_reverse_point_event(bigint, text) from public, anon;
revoke all on function public.admin_get_standings(uuid) from public, anon;
revoke all on function public.admin_recent_point_events(uuid, integer) from public, anon;

grant execute on function public.admin_update_ranking_settings(uuid, boolean, text, text, integer) to authenticated;
grant execute on function public.admin_adjust_points(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.admin_reverse_point_event(bigint, text) to authenticated;
grant execute on function public.admin_get_standings(uuid) to authenticated;
grant execute on function public.admin_recent_point_events(uuid, integer) to authenticated;

-- ===========================================================================
-- Sign-up: phone, optional marketing consent and initial participant state
-- ===========================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_birth_date date;
  v_age_declaration public.age_declaration;
  v_department public.elsalvador_department;
  v_registered_at timestamptz := pg_catalog.statement_timestamp();
begin
  if v_metadata ?| array['role', 'points', 'disciplinary_status', 'passport_code'] then
    raise exception using
      errcode = '22023',
      message = 'El registro contiene campos no permitidos.';
  end if;

  if pg_catalog.jsonb_typeof(v_metadata -> 'accepted_rules') is distinct from 'boolean'
    or pg_catalog.jsonb_typeof(v_metadata -> 'accepted_privacy') is distinct from 'boolean'
    or (v_metadata ->> 'accepted_rules')::boolean is not true
    or (v_metadata ->> 'accepted_privacy')::boolean is not true
  then
    raise exception using
      errcode = '22023',
      message = 'Debe aceptar las reglas y la política de privacidad.';
  end if;

  if coalesce(v_metadata ->> 'phone', '') !~ '^\+503[267][0-9]{7}$' then
    raise exception using
      errcode = '22023',
      message = 'El teléfono no es válido.';
  end if;

  if coalesce(v_metadata ->> 'birth_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using
      errcode = '22023',
      message = 'La fecha de nacimiento no es válida.';
  end if;

  begin
    v_birth_date := (v_metadata ->> 'birth_date')::date;
    v_age_declaration :=
      (v_metadata ->> 'age_declaration')::public.age_declaration;
    v_department :=
      (v_metadata ->> 'department')::public.elsalvador_department;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception using
        errcode = '22023',
        message = 'Los datos de registro no son válidos.';
  end;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    alias,
    birth_date,
    age_declaration,
    department,
    avatar_id,
    phone,
    marketing_consent_at,
    rules_accepted_at,
    privacy_accepted_at,
    profile_completed_at
  )
  values (
    new.id,
    v_metadata ->> 'first_name',
    v_metadata ->> 'last_name',
    v_metadata ->> 'alias',
    v_birth_date,
    v_age_declaration,
    v_department,
    v_metadata ->> 'avatar_id',
    v_metadata ->> 'phone',
    case
      when pg_catalog.jsonb_typeof(v_metadata -> 'marketing_consent') = 'boolean'
        and (v_metadata ->> 'marketing_consent')::boolean
      then v_registered_at
    end,
    v_registered_at,
    v_registered_at,
    v_registered_at
  );

  insert into private.user_roles (user_id, role)
  values (new.id, 'participant'::public.app_role);

  insert into private.participant_states (user_id)
  values (new.id);

  insert into public.rules_acceptances (user_id, rules_version_id, accepted_at)
  select new.id, rules.id, v_registered_at
  from public.campaign_rules_versions as rules
  where rules.campaign_id = private.current_campaign_id()
  order by rules.version desc
  limit 1;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

commit;
