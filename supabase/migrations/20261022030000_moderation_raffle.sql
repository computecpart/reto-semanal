begin;

-- ===========================================================================
-- Participants directory and moderation
-- ===========================================================================

create function public.admin_list_participants(
  p_query text,
  p_status text,
  p_department text,
  p_age text,
  p_role text,
  p_limit integer,
  p_offset integer
)
returns table (
  user_id uuid,
  alias text,
  first_name text,
  last_name text,
  email text,
  phone text,
  department text,
  age integer,
  is_adult boolean,
  avatar_id text,
  passport_code text,
  status public.participant_status,
  role public.app_role,
  points bigint,
  registered_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.statement_timestamp() at time zone 'America/El_Salvador')::date;
  v_query text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_query, ''))), '');
begin
  perform private.require_role('admin', 'superadmin');

  return query
  with base as (
    select
      profiles.id as uid,
      profiles.alias as c_alias,
      profiles.first_name as c_first,
      profiles.last_name as c_last,
      users.email::text as c_email,
      profiles.phone as c_phone,
      profiles.department::text as c_department,
      extract(year from pg_catalog.age(v_today, profiles.birth_date))::integer as c_age,
      (profiles.birth_date + interval '18 years')::date <= v_today as c_adult,
      profiles.avatar_id as c_avatar,
      profiles.passport_code as c_passport,
      coalesce(states.status, 'active'::public.participant_status) as c_status,
      roles.role as c_role,
      coalesce((
        select sum(events.amount) from public.point_events as events
        where events.user_id = profiles.id and events.campaign_id = private.current_campaign_id()
      ), 0)::bigint as c_points,
      profiles.created_at as c_created
    from public.profiles as profiles
    join auth.users as users on users.id = profiles.id
    join private.user_roles as roles on roles.user_id = profiles.id
    left join private.participant_states as states on states.user_id = profiles.id
    where (v_query is null
        or pg_catalog.lower(profiles.alias) like '%' || v_query || '%'
        or pg_catalog.lower(profiles.first_name || ' ' || profiles.last_name) like '%' || v_query || '%'
        or pg_catalog.lower(users.email::text) like '%' || v_query || '%'
        or pg_catalog.lower(profiles.passport_code) like '%' || v_query || '%')
      and (nullif(p_status, '') is null or coalesce(states.status, 'active'::public.participant_status)::text = p_status)
      and (nullif(p_department, '') is null or profiles.department::text = p_department)
      and (nullif(p_role, '') is null or roles.role::text = p_role)
  ),
  filtered as (
    select * from base
    where nullif(p_age, '') is null
      or (p_age = 'adult' and base.c_adult)
      or (p_age = 'minor' and not base.c_adult)
  )
  select
    filtered.uid, filtered.c_alias, filtered.c_first, filtered.c_last, filtered.c_email, filtered.c_phone,
    filtered.c_department, filtered.c_age, filtered.c_adult, filtered.c_avatar, filtered.c_passport,
    filtered.c_status, filtered.c_role, filtered.c_points, filtered.c_created,
    pg_catalog.count(*) over ()
  from filtered
  order by filtered.c_created desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- CSV export of personal data: superadmin only and always audited.
create function public.admin_export_participants()
returns table (
  alias text,
  first_name text,
  last_name text,
  email text,
  phone text,
  department text,
  birth_date date,
  passport_code text,
  status text,
  role text,
  marketing_consent boolean,
  points bigint,
  registered_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_role('superadmin');

  perform private.write_audit(
    'participants.export', 'participants', null, private.current_campaign_id(), null,
    pg_catalog.jsonb_build_object('rows', (select count(*) from public.profiles))
  );

  return query
  select
    profiles.alias,
    profiles.first_name,
    profiles.last_name,
    users.email::text,
    profiles.phone,
    profiles.department::text,
    profiles.birth_date,
    profiles.passport_code,
    coalesce(states.status::text, 'active'),
    roles.role::text,
    profiles.marketing_consent_at is not null,
    coalesce((
      select sum(events.amount) from public.point_events as events
      where events.user_id = profiles.id and events.campaign_id = private.current_campaign_id()
    ), 0)::bigint,
    profiles.created_at
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.id
  join private.user_roles as roles on roles.user_id = profiles.id
  left join private.participant_states as states on states.user_id = profiles.id
  order by profiles.created_at;
end;
$$;

-- Admins act only on participants; superadmins on anyone except themselves.
create function public.admin_set_participant_status(
  p_user_id uuid,
  p_status public.participant_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.app_role;
  v_target_role public.app_role;
  v_before private.participant_states;
begin
  v_actor_role := private.require_role('admin', 'superadmin');

  if p_user_id = (select auth.uid()) then
    raise exception using errcode = '42501', message = 'No puedes cambiar tu propio estado.';
  end if;

  select role into v_target_role from private.user_roles where user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'El participante no existe.';
  end if;

  if v_actor_role = 'admin'::public.app_role and v_target_role <> 'participant'::public.app_role then
    raise exception using errcode = '42501', message = 'Un admin no puede moderar a otro admin ni a un superadmin.';
  end if;

  if char_length(coalesce(pg_catalog.btrim(p_reason), '')) < 10 then
    raise exception using errcode = '22023', message = 'Describe el motivo con al menos 10 caracteres.';
  end if;

  insert into private.participant_states (user_id) values (p_user_id) on conflict (user_id) do nothing;

  select * into v_before from private.participant_states where user_id = p_user_id for update;

  if v_before.status = p_status then
    raise exception using errcode = '22023', message = 'El participante ya tiene ese estado.';
  end if;

  update private.participant_states
  set
    status = p_status,
    reason = pg_catalog.btrim(p_reason),
    changed_at = pg_catalog.statement_timestamp(),
    changed_by = (select auth.uid())
  where user_id = p_user_id;

  perform private.write_audit(
    'participant.status', 'participant', p_user_id::text, private.current_campaign_id(),
    pg_catalog.jsonb_build_object('status', v_before.status),
    pg_catalog.jsonb_build_object('status', p_status),
    pg_catalog.btrim(p_reason)
  );
end;
$$;

-- ===========================================================================
-- Ranking: optional separate list of disqualified participants (no reason)
-- ===========================================================================

alter table public.campaigns
  add column ranking_show_disqualified boolean not null default false;

create function public.admin_set_show_disqualified(p_campaign_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before boolean;
begin
  perform private.require_role('admin', 'superadmin');

  select ranking_show_disqualified into v_before from public.campaigns where id = p_campaign_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  update public.campaigns
  set ranking_show_disqualified = coalesce(p_show, false), updated_by = (select auth.uid())
  where id = p_campaign_id;

  perform private.write_audit(
    'ranking.show_disqualified', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object('show', v_before), pg_catalog.jsonb_build_object('show', coalesce(p_show, false))
  );
end;
$$;

create function public.get_disqualified_participants()
returns table (alias text, avatar_id text, passport_hint text)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.alias, profiles.avatar_id, '••••-' || pg_catalog.right(profiles.passport_code, 4)
  from public.campaigns as campaigns
  join private.participant_states as states on states.status = 'disqualified'::public.participant_status
  join private.user_roles as roles on roles.user_id = states.user_id and roles.role = 'participant'::public.app_role
  join public.profiles as profiles on profiles.id = states.user_id
  where campaigns.id = private.current_campaign_id()
    and campaigns.ranking_visible
    and campaigns.ranking_show_disqualified
    and (campaigns.ranking_audience = 'public' or (select auth.uid()) is not null)
  order by profiles.alias;
$$;

revoke all on function public.get_disqualified_participants() from public;
grant execute on function public.get_disqualified_participants() to anon, authenticated;

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
    'show_disqualified', campaigns.ranking_show_disqualified,
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

-- ===========================================================================
-- Alias moderation (PostgreSQL is the authority; TS is only a UX filter)
-- ===========================================================================

alter table private.blocked_alias_terms
  add column active boolean not null default true,
  add column created_at timestamptz not null default now(),
  add column created_by uuid;

create or replace function private.alias_is_allowed(p_alias text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_leet_alias text;
  v_letters text;
  v_leet_letters text;
begin
  if p_alias is null
    or p_alias <> private.normalize_alias(p_alias)
    or char_length(p_alias) not between 3 and 24
    or p_alias !~ '^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$'
  then
    return false;
  end if;

  -- The allowlist above rejects URLs, HTML and arbitrary Unicode. These reduced
  -- forms also catch separators, numeric suffixes and common leetspeak.
  v_leet_alias := pg_catalog.translate(p_alias, '01345789', 'oieastbg');
  v_letters := pg_catalog.regexp_replace(p_alias, '[^a-z]', '', 'g');
  v_leet_letters := pg_catalog.regexp_replace(v_leet_alias, '[^a-z]', '', 'g');

  return not exists (
    select 1
    from private.blocked_alias_terms as blocked
    where blocked.active
      and (
        v_letters = blocked.term
        or v_leet_letters = blocked.term
        or p_alias ~ ('(^|[_-])' || blocked.term || '([_-]|[0-9]|$)')
        or v_leet_alias ~ ('(^|[_-])' || blocked.term || '([_-]|[0-9]|$)')
      )
  );
end;
$$;

revoke all on function private.alias_is_allowed(text) from public, anon, authenticated;

create function public.admin_list_blocked_terms()
returns table (term text, category text, active boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return query
  select blocked.term, blocked.category, blocked.active, blocked.created_at
  from private.blocked_alias_terms as blocked
  order by blocked.active desc, blocked.category, blocked.term;
end;
$$;

create function public.admin_upsert_blocked_term(p_term text, p_category text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_term, '')));
  v_before jsonb;
begin
  perform private.require_role('admin', 'superadmin');

  if v_term !~ '^[a-z]{3,40}$' then
    raise exception using errcode = '22023', message = 'El término debe tener de 3 a 40 letras sin acentos ni espacios.';
  end if;

  if p_category not in ('reserved', 'offensive') then
    raise exception using errcode = '22023', message = 'Categoría no válida.';
  end if;

  select pg_catalog.to_jsonb(blocked) into v_before from private.blocked_alias_terms as blocked where blocked.term = v_term;

  insert into private.blocked_alias_terms (term, category, active, created_by)
  values (v_term, p_category, coalesce(p_active, true), (select auth.uid()))
  on conflict (term) do update set category = excluded.category, active = excluded.active;

  perform private.write_audit(
    'alias_term.upsert', 'blocked_alias_term', v_term, null, v_before,
    pg_catalog.jsonb_build_object('category', p_category, 'active', coalesce(p_active, true))
  );
end;
$$;

-- Existing aliases that the current list would reject: for manual review only.
create function public.admin_alias_conflicts()
returns table (user_id uuid, alias text, passport_code text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return query
  select profiles.id, profiles.alias, profiles.passport_code, profiles.first_name || ' ' || profiles.last_name
  from public.profiles as profiles
  where profiles.alias is not null and not private.alias_is_allowed(profiles.alias)
  order by profiles.alias;
end;
$$;

-- ===========================================================================
-- Administrators (superadmin only; there is always at least one superadmin)
-- ===========================================================================

create function public.admin_list_staff()
returns table (user_id uuid, alias text, full_name text, email text, role public.app_role)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('superadmin');

  return query
  select roles.user_id, profiles.alias, profiles.first_name || ' ' || profiles.last_name, users.email::text, roles.role
  from private.user_roles as roles
  join auth.users as users on users.id = roles.user_id
  left join public.profiles as profiles on profiles.id = roles.user_id
  where roles.role in ('admin'::public.app_role, 'superadmin'::public.app_role)
  order by roles.role desc, profiles.alias;
end;
$$;

create function public.admin_set_role(p_email text, p_role public.app_role, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_current public.app_role;
  v_superadmins integer;
begin
  perform private.require_role('superadmin');

  if char_length(coalesce(pg_catalog.btrim(p_reason), '')) < 10 then
    raise exception using errcode = '22023', message = 'Describe el motivo con al menos 10 caracteres.';
  end if;

  select users.id into v_user_id
  from auth.users as users
  where pg_catalog.lower(users.email::text) = pg_catalog.lower(pg_catalog.btrim(p_email));

  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'No existe una cuenta con ese correo.';
  end if;

  -- Serialize role changes and count superadmins inside this transaction.
  perform 1 from private.user_roles where role = 'superadmin'::public.app_role for update;

  select role into v_current from private.user_roles where user_id = v_user_id for update;

  if v_current = p_role then
    raise exception using errcode = '22023', message = 'La cuenta ya tiene ese rol.';
  end if;

  if v_current = 'superadmin'::public.app_role then
    select count(*) into v_superadmins from private.user_roles where role = 'superadmin'::public.app_role;

    if v_superadmins <= 1 then
      raise exception using errcode = '55000', message = 'Debe quedar al menos un superadmin.';
    end if;
  end if;

  update private.user_roles set role = p_role where user_id = v_user_id;

  insert into private.role_audit_log (target_user_id, previous_role, new_role, actor_database_role, reason)
  values (v_user_id, v_current, p_role, 'superadmin:' || (select auth.uid())::text, pg_catalog.btrim(p_reason));

  perform private.write_audit(
    'role.change', 'user', v_user_id::text, null,
    pg_catalog.jsonb_build_object('role', v_current),
    pg_catalog.jsonb_build_object('role', p_role),
    pg_catalog.btrim(p_reason)
  );
end;
$$;

-- ===========================================================================
-- Audit viewer (read-only)
-- ===========================================================================

create function public.admin_list_audit(
  p_action text,
  p_entity text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer,
  p_offset integer
)
returns table (
  occurred_at timestamptz,
  action text,
  actor_alias text,
  actor_role text,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return query
  select * from (
    select
      log.occurred_at,
      log.action,
      profiles.alias,
      log.actor_role::text,
      log.entity_type,
      log.entity_id,
      log.before,
      log.after,
      log.reason
    from private.audit_log as log
    left join public.profiles as profiles on profiles.id = log.actor_id
    union all
    select
      roles.created_at,
      'role.bootstrap',
      null,
      roles.actor_database_role,
      'user',
      roles.target_user_id::text,
      pg_catalog.jsonb_build_object('role', roles.previous_role),
      pg_catalog.jsonb_build_object('role', roles.new_role),
      roles.reason
    from private.role_audit_log as roles
    where roles.actor_database_role not like 'superadmin:%'
  ) as entries
  where (nullif(p_action, '') is null or entries.action like p_action || '%')
    and (nullif(p_entity, '') is null or entries.entity_type = p_entity)
    and (p_from is null or entries.occurred_at >= p_from)
    and (p_to is null or entries.occurred_at < p_to)
  order by entries.occurred_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ===========================================================================
-- Raffle (rules 8 and 11): verifiable draw among eligible participants
-- ===========================================================================

-- Eligible: participant role, complete profile, not disqualified or archived.
-- Points do not change the odds.
create function private.raffle_eligible(p_campaign_id uuid)
returns table (passport_code text, alias text, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.passport_code, profiles.alias, profiles.id
  from public.profiles as profiles
  join private.user_roles as roles on roles.user_id = profiles.id and roles.role = 'participant'::public.app_role
  left join private.participant_states as states on states.user_id = profiles.id
  where profiles.profile_completed_at is not null
    and coalesce(states.status, 'active'::public.participant_status)
      not in ('disqualified'::public.participant_status, 'archived'::public.participant_status)
    and p_campaign_id is not null
  order by profiles.passport_code;
$$;

revoke all on function private.raffle_eligible(uuid) from public, anon, authenticated;

create table private.raffle_draws (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  drawn_at timestamptz not null default now(),
  drawn_by uuid not null,
  public_seed text not null check (char_length(public_seed) between 4 and 200),
  eligible_count integer not null,
  eligible_hash text not null,
  winners jsonb not null
);

alter table private.raffle_draws enable row level security;
revoke all on table private.raffle_draws from public, anon, authenticated;

create trigger raffle_draws_immutable
before update or delete on private.raffle_draws
for each row execute function private.forbid_mutation();

create function public.admin_raffle_preview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := private.current_campaign_id();
begin
  perform private.require_role('superadmin');

  return pg_catalog.jsonb_build_object(
    'eligible_count', (select count(*) from private.raffle_eligible(v_campaign_id)),
    'eligible_hash', (
      select pg_catalog.encode(extensions.digest(coalesce(pg_catalog.string_agg(eligible.passport_code, ',' order by eligible.passport_code), ''), 'sha256'), 'hex')
      from private.raffle_eligible(v_campaign_id) as eligible
    ),
    'eligible_codes', (
      select coalesce(pg_catalog.jsonb_agg(eligible.passport_code order by eligible.passport_code), '[]'::jsonb)
      from private.raffle_eligible(v_campaign_id) as eligible
    ),
    'draws', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(draws) order by draws.drawn_at desc)
      from private.raffle_draws as draws
      where draws.campaign_id = v_campaign_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Winner i: index = (first 15 hex digits of sha256(seed:list_hash:i)) mod
-- remaining, over the sorted passport list without replacement. Anyone with
-- the published list and the public seed can recompute the result.
create function public.admin_run_raffle(p_public_seed text, p_winners integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := private.current_campaign_id();
  v_codes text[];
  v_hash text;
  v_winners jsonb := '[]'::jsonb;
  v_index integer;
  v_digest text;
  v_round integer;
  v_draw private.raffle_draws;
begin
  perform private.require_role('superadmin');

  if v_campaign_id is null then
    raise exception using errcode = 'P0002', message = 'No hay campaña actual.';
  end if;

  if char_length(coalesce(pg_catalog.btrim(p_public_seed), '')) < 4 then
    raise exception using errcode = '22023', message = 'La semilla pública debe tener al menos 4 caracteres.';
  end if;

  if p_winners is null or p_winners < 1 or p_winners > 20 then
    raise exception using errcode = '22023', message = 'Elige entre 1 y 20 ganadores (titular y suplentes).';
  end if;

  select pg_catalog.array_agg(eligible.passport_code order by eligible.passport_code)
  into v_codes
  from private.raffle_eligible(v_campaign_id) as eligible;

  if coalesce(pg_catalog.array_length(v_codes, 1), 0) < p_winners then
    raise exception using errcode = '22023', message = 'No hay suficientes participantes elegibles.';
  end if;

  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.array_to_string(v_codes, ','), 'sha256'), 'hex');

  for v_round in 1..p_winners loop
    v_digest := pg_catalog.encode(
      extensions.digest(pg_catalog.btrim(p_public_seed) || ':' || v_hash || ':' || v_round, 'sha256'), 'hex'
    );
    v_index := (('x' || pg_catalog.lpad(pg_catalog.left(v_digest, 15), 16, '0'))::bit(64)::bigint
      % pg_catalog.array_length(v_codes, 1))::integer + 1;

    v_winners := v_winners || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'position', v_round,
      'passport_code', v_codes[v_index],
      'alias', (select profiles.alias from public.profiles as profiles where profiles.passport_code = v_codes[v_index])
    ));

    v_codes := v_codes[1:v_index - 1] || v_codes[v_index + 1:];
  end loop;

  insert into private.raffle_draws (campaign_id, drawn_by, public_seed, eligible_count, eligible_hash, winners)
  values (
    v_campaign_id,
    (select auth.uid()),
    pg_catalog.btrim(p_public_seed),
    pg_catalog.array_length(v_codes, 1) + p_winners,
    v_hash,
    v_winners
  )
  returning * into v_draw;

  perform private.write_audit(
    'raffle.draw', 'raffle', v_draw.id::text, v_campaign_id, null,
    pg_catalog.jsonb_build_object('seed', v_draw.public_seed, 'eligible', v_draw.eligible_count, 'hash', v_hash, 'winners', v_winners)
  );

  return pg_catalog.to_jsonb(v_draw);
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================

revoke all on function public.admin_list_participants(text, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_export_participants() from public, anon;
revoke all on function public.admin_set_participant_status(uuid, public.participant_status, text) from public, anon;
revoke all on function public.admin_set_show_disqualified(uuid, boolean) from public, anon;
revoke all on function public.admin_list_blocked_terms() from public, anon;
revoke all on function public.admin_upsert_blocked_term(text, text, boolean) from public, anon;
revoke all on function public.admin_alias_conflicts() from public, anon;
revoke all on function public.admin_list_staff() from public, anon;
revoke all on function public.admin_set_role(text, public.app_role, text) from public, anon;
revoke all on function public.admin_list_audit(text, text, timestamptz, timestamptz, integer, integer) from public, anon;
revoke all on function public.admin_raffle_preview() from public, anon;
revoke all on function public.admin_run_raffle(text, integer) from public, anon;

grant execute on function public.admin_list_participants(text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_export_participants() to authenticated;
grant execute on function public.admin_set_participant_status(uuid, public.participant_status, text) to authenticated;
grant execute on function public.admin_set_show_disqualified(uuid, boolean) to authenticated;
grant execute on function public.admin_list_blocked_terms() to authenticated;
grant execute on function public.admin_upsert_blocked_term(text, text, boolean) to authenticated;
grant execute on function public.admin_alias_conflicts() to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_set_role(text, public.app_role, text) to authenticated;
grant execute on function public.admin_list_audit(text, text, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.admin_raffle_preview() to authenticated;
grant execute on function public.admin_run_raffle(text, integer) to authenticated;

commit;
