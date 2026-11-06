-- Private campaigns running alongside the main one (invitation link, own URL,
-- own quizzes, missions, points, ranking and rules; same accounts).
--
-- The main campaign is unaffected by design:
-- * private.current_campaign_id() only changes when a request carries the
--   x-campaign header AND the caller is a member (or staff). Without it, it
--   resolves the same public campaign as before.
-- * Every existing RPC keeps working unchanged: they all read that function.
-- * Accounts created from an invitation stay out of the main campaign's ranking
--   and raffle; a trigger enforces it on every write of points, attempts and
--   redemptions.
begin;

-- ===========================================================================
-- Campaign type and invitation link
-- ===========================================================================

alter table public.campaigns
  add column is_private boolean not null default false,
  add column invite_token text unique check (invite_token ~ '^[0-9a-f]{32}$'),
  add column invite_enabled boolean not null default true,
  add constraint campaigns_private_has_invite check (not is_private or invite_token is not null);

-- Only one public campaign can be published; private ones run in parallel.
create unique index campaigns_single_published_public
on public.campaigns ((true))
where status = 'published' and not is_private;

drop index public.campaigns_single_published;

-- ===========================================================================
-- Membership
-- ===========================================================================

create table private.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user on private.campaign_members (user_id);

alter table private.campaign_members enable row level security;
revoke all on table private.campaign_members from public, anon, authenticated;

-- Accounts born from an invitation: they are not part of the main campaign.
create table private.private_only_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.private_only_accounts enable row level security;
revoke all on table private.private_only_accounts from public, anon, authenticated;

create function private.user_in_campaign(p_user_id uuid, p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when campaigns.is_private then exists (
        select 1 from private.campaign_members as members
        where members.campaign_id = campaigns.id and members.user_id = p_user_id
      )
      else not exists (
        select 1 from private.private_only_accounts as accounts
        where accounts.user_id = p_user_id
      )
    end
    from public.campaigns as campaigns
    where campaigns.id = p_campaign_id
  ), false);
$$;

revoke all on function private.user_in_campaign(uuid, uuid) from public, anon, authenticated;

create function private.campaign_from_invite(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select campaigns.id
  from public.campaigns as campaigns
  where p_token ~ '^[0-9a-f]{32}$'
    and campaigns.invite_token = p_token
    and campaigns.is_private
    and campaigns.invite_enabled
    and campaigns.status = 'published'::public.campaign_status
    and pg_catalog.statement_timestamp() < coalesce(campaigns.ends_at, 'infinity'::timestamptz);
$$;

revoke all on function private.campaign_from_invite(text) from public, anon, authenticated;

-- ===========================================================================
-- Campaign resolution
-- ===========================================================================

create function private.primary_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select campaigns.id
      from public.campaigns as campaigns
      where campaigns.status = 'published'::public.campaign_status
        and not campaigns.is_private
    ),
    (
      select campaigns.id
      from public.campaigns as campaigns
      where campaigns.status in (
        'closed'::public.campaign_status,
        'finalized'::public.campaign_status
      )
        and not campaigns.is_private
      order by campaigns.ends_at desc nulls last, campaigns.updated_at desc
      limit 1
    )
  );
$$;

revoke all on function private.primary_campaign_id() from public, anon, authenticated;

-- The x-campaign request header is only a request: members of that private
-- campaign and staff get it, anyone else silently stays on the main campaign.
create function private.requested_campaign_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text := nullif(pg_catalog.current_setting('request.headers', true), '')::json ->> 'x-campaign';
  v_campaign public.campaigns;
begin
  if v_slug is null then
    return null;
  end if;

  select * into v_campaign
  from public.campaigns as campaigns
  where campaigns.slug = v_slug
    and campaigns.is_private
    and campaigns.status <> 'archived'::public.campaign_status;

  if not found then
    return null;
  end if;

  if public.is_admin() then
    return v_campaign.id;
  end if;

  if v_campaign.status <> 'draft'::public.campaign_status
    and private.user_in_campaign((select auth.uid()), v_campaign.id) then
    return v_campaign.id;
  end if;

  return null;
end;
$$;

revoke all on function private.requested_campaign_id() from public, anon, authenticated;

create or replace function private.current_campaign_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.requested_campaign_id(), private.primary_campaign_id());
$$;

-- ===========================================================================
-- Participation guard: points, attempts and redemptions belong to members only
-- ===========================================================================

create function private.enforce_campaign_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.user_in_campaign(new.user_id, new.campaign_id) then
    raise exception using
      errcode = '42501',
      message = 'Tu cuenta no participa en esta campaña.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_campaign_participation() from public, anon, authenticated;

create trigger point_events_campaign_participation
before insert on public.point_events
for each row execute function private.enforce_campaign_participation();

create trigger quiz_attempts_campaign_participation
before insert on public.quiz_attempts
for each row execute function private.enforce_campaign_participation();

create trigger reward_redemptions_campaign_participation
before insert on public.reward_redemptions
for each row execute function private.enforce_campaign_participation();

-- ===========================================================================
-- Existing functions: copied from their latest definition, one condition added
-- ===========================================================================

create or replace function private.campaign_standings(p_campaign_id uuid)
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
      and private.user_in_campaign(roles.user_id, p_campaign_id)
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

create or replace function private.raffle_eligible(p_campaign_id uuid)
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
    and private.user_in_campaign(profiles.id, p_campaign_id)
  order by profiles.passport_code;
$$;

create or replace function public.admin_list_participants(
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
    where private.user_in_campaign(profiles.id, private.current_campaign_id())
      and (v_query is null
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

create or replace function public.admin_export_participants()
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
  where private.user_in_campaign(profiles.id, private.current_campaign_id())
  order by profiles.created_at;
end;
$$;

create or replace function public.admin_set_campaign_status(
  p_campaign_id uuid,
  p_status public.campaign_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_allowed boolean;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_campaign
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  v_allowed := (v_campaign.status, p_status) in (
    ('draft'::public.campaign_status, 'published'::public.campaign_status),
    ('draft'::public.campaign_status, 'archived'::public.campaign_status),
    ('published'::public.campaign_status, 'closed'::public.campaign_status),
    ('closed'::public.campaign_status, 'published'::public.campaign_status),
    ('closed'::public.campaign_status, 'finalized'::public.campaign_status),
    ('finalized'::public.campaign_status, 'archived'::public.campaign_status)
  );

  if not v_allowed then
    raise exception using
      errcode = '22023',
      message = 'Ese cambio de estado no está permitido.';
  end if;

  if p_status = 'published'::public.campaign_status then
    if v_campaign.starts_at is null or v_campaign.ends_at is null then
      raise exception using
        errcode = '22023',
        message = 'Define las fechas de inicio y cierre antes de publicar.';
    end if;

    if not exists (
      select 1 from public.campaign_rules_versions as rules
      where rules.campaign_id = p_campaign_id
    ) then
      raise exception using
        errcode = '22023',
        message = 'Publica las reglas antes de publicar la campaña.';
    end if;

    if not exists (
      select 1 from public.landing_pages as landing
      where landing.campaign_id = p_campaign_id and landing.published is not null
    ) then
      raise exception using
        errcode = '22023',
        message = 'Publica la portada antes de publicar la campaña.';
    end if;

    -- Private campaigns run alongside the main one; only one public campaign.
    if not v_campaign.is_private and exists (
      select 1 from public.campaigns as campaigns
      where campaigns.status = 'published'::public.campaign_status
        and not campaigns.is_private
        and campaigns.id <> p_campaign_id
    ) then
      raise exception using
        errcode = '55000',
        message = 'Ya existe otra campaña publicada.';
    end if;
  end if;

  update public.campaigns
  set status = p_status, updated_by = (select auth.uid())
  where id = p_campaign_id;

  perform private.write_audit(
    'campaign.status', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object('status', v_campaign.status),
    pg_catalog.jsonb_build_object('status', p_status),
    nullif(pg_catalog.btrim(p_reason), '')
  );
end;
$$;

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
  -- Null for every regular sign-up: the steps below then behave exactly as before.
  v_invited_campaign uuid := private.campaign_from_invite(v_metadata ->> 'invite_token');
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

  -- Signing up from an invitation joins that campaign only.
  if v_invited_campaign is not null then
    insert into private.campaign_members (campaign_id, user_id)
    values (v_invited_campaign, new.id);

    insert into private.private_only_accounts (user_id, campaign_id)
    values (new.id, v_invited_campaign);
  end if;

  insert into public.rules_acceptances (user_id, rules_version_id, accepted_at)
  select new.id, rules.id, v_registered_at
  from public.campaign_rules_versions as rules
  where rules.campaign_id = coalesce(v_invited_campaign, private.current_campaign_id())
  order by rules.version desc
  limit 1;

  return new;
end;
$$;

-- ===========================================================================
-- Participant RPCs
-- ===========================================================================

-- Anyone holding the link can read this; without it nothing is exposed.
create function public.get_campaign_invite(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'campaign', pg_catalog.jsonb_build_object(
      'name', campaigns.name,
      'slug', campaigns.slug,
      'status', campaigns.status,
      'starts_at', campaigns.starts_at,
      'ends_at', campaigns.ends_at,
      'prize_title', campaigns.prize_title,
      'prize_description', campaigns.prize_description
    ),
    'landing', landing.published,
    'rules_md', (
      select rules.content_md
      from public.campaign_rules_versions as rules
      where rules.campaign_id = campaigns.id
      order by rules.version desc
      limit 1
    ),
    'is_member', exists (
      select 1 from private.campaign_members as members
      where members.campaign_id = campaigns.id and members.user_id = (select auth.uid())
    )
  )
  from public.campaigns as campaigns
  left join public.landing_pages as landing on landing.campaign_id = campaigns.id
  where campaigns.id = private.campaign_from_invite(p_token);
$$;

revoke all on function public.get_campaign_invite(text) from public;
grant execute on function public.get_campaign_invite(text) to anon, authenticated;

create function public.get_my_campaigns()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'private_only', exists (
      select 1 from private.private_only_accounts as accounts
      where accounts.user_id = (select auth.uid())
    ),
    'primary_name', (
      select campaigns.name from public.campaigns as campaigns
      where campaigns.id = private.primary_campaign_id()
    ),
    'campaigns', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('name', campaigns.name, 'slug', campaigns.slug, 'status', campaigns.status)
        order by campaigns.created_at
      )
      from public.campaigns as campaigns
      where campaigns.is_private
        and (
          (public.is_admin() and campaigns.status <> 'archived'::public.campaign_status)
          or (
            campaigns.status in (
              'published'::public.campaign_status,
              'closed'::public.campaign_status,
              'finalized'::public.campaign_status
            )
            and exists (
              select 1 from private.campaign_members as members
              where members.campaign_id = campaigns.id and members.user_id = (select auth.uid())
            )
          )
        )
    ), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

revoke all on function public.get_my_campaigns() from public, anon;
grant execute on function public.get_my_campaigns() to authenticated;

-- Joining accepts the rules shown on the invitation. Idempotent.
create function public.join_campaign(p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_campaign public.campaigns;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  select * into v_campaign
  from public.campaigns as campaigns
  where campaigns.id = private.campaign_from_invite(p_token);

  if not found then
    raise exception using errcode = 'P0002', message = 'Este enlace de invitación no es válido o ya no está activo.';
  end if;

  if not private.is_competitor(v_user_id) then
    raise exception using errcode = '42501', message = 'Las cuentas del equipo organizador no participan en las campañas.';
  end if;

  if exists (
    select 1 from private.participant_states as states
    where states.user_id = v_user_id
      and states.status in ('disqualified'::public.participant_status, 'archived'::public.participant_status)
  ) then
    raise exception using errcode = '42501', message = 'Tu cuenta no puede unirse a esta campaña.';
  end if;

  insert into private.campaign_members (campaign_id, user_id)
  values (v_campaign.id, v_user_id)
  on conflict do nothing;

  insert into public.rules_acceptances (user_id, rules_version_id)
  select v_user_id, rules.id
  from public.campaign_rules_versions as rules
  where rules.campaign_id = v_campaign.id
  order by rules.version desc
  limit 1
  on conflict do nothing;

  return v_campaign.slug;
end;
$$;

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;

-- An invited account can also enter the main campaign later on.
create function public.join_primary_campaign()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesión autenticada.';
  end if;

  delete from private.private_only_accounts as accounts
  where accounts.user_id = (select auth.uid());
end;
$$;

revoke all on function public.join_primary_campaign() from public, anon;
grant execute on function public.join_primary_campaign() to authenticated;

-- ===========================================================================
-- Administrative RPCs
-- ===========================================================================

create function public.admin_set_campaign_private(p_campaign_id uuid, p_private boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_campaign from public.campaigns where id = p_campaign_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  if v_campaign.status <> 'draft'::public.campaign_status then
    raise exception using errcode = '55000', message = 'Solo una campaña en borrador puede cambiar de tipo.';
  end if;

  update public.campaigns
  set
    is_private = coalesce(p_private, false),
    -- Members expect a ranking; it stays limited to signed-in members.
    ranking_visible = ranking_visible or coalesce(p_private, false),
    invite_token = case
      when coalesce(p_private, false)
        then coalesce(invite_token, pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''))
    end,
    updated_by = (select auth.uid())
  where id = p_campaign_id;

  perform private.write_audit(
    'campaign.type', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object('is_private', v_campaign.is_private),
    pg_catalog.jsonb_build_object('is_private', coalesce(p_private, false))
  );
end;
$$;

-- A new link invalidates the shared one; people already inside stay members.
create function public.admin_regenerate_campaign_invite(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_campaign from public.campaigns where id = p_campaign_id for update;

  if not found or not v_campaign.is_private then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  update public.campaigns
  set
    invite_token = pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    updated_by = (select auth.uid())
  where id = p_campaign_id;

  perform private.write_audit('campaign.invite_regenerate', 'campaign', p_campaign_id::text, p_campaign_id, null, null);
end;
$$;

create function public.admin_set_campaign_invite(p_campaign_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_campaign from public.campaigns where id = p_campaign_id for update;

  if not found or not v_campaign.is_private then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  update public.campaigns
  set invite_enabled = coalesce(p_enabled, false), updated_by = (select auth.uid())
  where id = p_campaign_id;

  perform private.write_audit(
    'campaign.invite', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object('enabled', v_campaign.invite_enabled),
    pg_catalog.jsonb_build_object('enabled', coalesce(p_enabled, false))
  );
end;
$$;

create function public.admin_campaign_member_count(p_campaign_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return (
    select count(*) from private.campaign_members as members
    where members.campaign_id = p_campaign_id
  );
end;
$$;

revoke all on function public.admin_set_campaign_private(uuid, boolean) from public, anon;
revoke all on function public.admin_regenerate_campaign_invite(uuid) from public, anon;
revoke all on function public.admin_set_campaign_invite(uuid, boolean) from public, anon;
revoke all on function public.admin_campaign_member_count(uuid) from public, anon;

grant execute on function public.admin_set_campaign_private(uuid, boolean) to authenticated;
grant execute on function public.admin_regenerate_campaign_invite(uuid) to authenticated;
grant execute on function public.admin_set_campaign_invite(uuid, boolean) to authenticated;
grant execute on function public.admin_campaign_member_count(uuid) to authenticated;

commit;
