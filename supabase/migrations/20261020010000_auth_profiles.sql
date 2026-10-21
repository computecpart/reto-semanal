begin;

-- Alias normalization is enforced in PostgreSQL as well as in the application.
-- Supabase projects expose extensions from this schema by default.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create type public.age_declaration as enum ('minor', 'adult');

create type public.elsalvador_department as enum (
  'Ahuachapán',
  'Cabañas',
  'Chalatenango',
  'Cuscatlán',
  'La Libertad',
  'La Paz',
  'La Unión',
  'Morazán',
  'San Miguel',
  'San Salvador',
  'San Vicente',
  'Santa Ana',
  'Sonsonate',
  'Usulután'
);

revoke all on type public.age_declaration from public, anon;
revoke all on type public.elsalvador_department from public, anon;
grant usage on type public.age_declaration to authenticated;
grant usage on type public.elsalvador_department to authenticated;

alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column alias text,
  add column birth_date date,
  add column age_declaration public.age_declaration,
  add column department public.elsalvador_department,
  add column avatar_id text,
  add column rules_accepted_at timestamptz,
  add column privacy_accepted_at timestamptz,
  add column profile_completed_at timestamptz,
  add constraint profiles_first_name_valid check (
    first_name is null
    or (
      first_name = btrim(first_name)
      and char_length(first_name) between 1 and 80
    )
  ),
  add constraint profiles_last_name_valid check (
    last_name is null
    or (
      last_name = btrim(last_name)
      and char_length(last_name) between 1 and 80
    )
  ),
  add constraint profiles_alias_format check (
    alias is null
    or (
      alias = lower(alias)
      and alias = btrim(alias)
      and char_length(alias) between 3 and 24
      and alias ~ '^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$'
    )
  ),
  add constraint profiles_avatar_allowed check (
    avatar_id is null
    or avatar_id ~ '^avatar-(0[1-9]|1[0-2])$'
  ),
  add constraint profiles_completed_fields_present check (
    profile_completed_at is null
    or (
      first_name is not null
      and last_name is not null
      and alias is not null
      and birth_date is not null
      and age_declaration is not null
      and department is not null
      and avatar_id is not null
      and rules_accepted_at is not null
      and privacy_accepted_at is not null
    )
  ),
  add constraint profiles_acceptance_precedes_completion check (
    profile_completed_at is null
    or (
      rules_accepted_at <= profile_completed_at
      and privacy_accepted_at <= profile_completed_at
    )
  );

comment on column public.profiles.alias is
  'Alias canónico público. Su forma normalizada es la única que se almacena.';
comment on column public.profiles.birth_date is
  'Fecha civil declarada. No se modifica después de completar el perfil.';
comment on column public.profiles.profile_completed_at is
  'Timestamp de base de datos que indica que todos los datos obligatorios fueron validados.';

create unique index profiles_alias_case_insensitive_key
on public.profiles (lower(alias))
where alias is not null;

-- The list is private so clients cannot use it to probe or alter moderation rules.
create table private.blocked_alias_terms (
  term text primary key,
  category text not null check (category in ('reserved', 'offensive')),
  constraint blocked_alias_terms_canonical check (term ~ '^[a-z]+$')
);

alter table private.blocked_alias_terms enable row level security;
revoke all on table private.blocked_alias_terms from public, anon, authenticated;

insert into private.blocked_alias_terms (term, category)
values
  ('admin', 'reserved'),
  ('administrador', 'reserved'),
  ('administrator', 'reserved'),
  ('superadmin', 'reserved'),
  ('support', 'reserved'),
  ('soporte', 'reserved'),
  ('staff', 'reserved'),
  ('oficial', 'reserved'),
  ('official', 'reserved'),
  ('moderador', 'reserved'),
  ('moderator', 'reserved'),
  ('bitch', 'offensive'),
  ('culero', 'offensive'),
  ('fuck', 'offensive'),
  ('mierda', 'offensive'),
  ('pendejo', 'offensive'),
  ('puta', 'offensive'),
  ('puto', 'offensive'),
  ('verga', 'offensive');

create function private.normalize_person_name(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.btrim(
    pg_catalog.regexp_replace(p_value, '[[:space:]]+', ' ', 'g')
  );
$$;

create function private.normalize_alias(p_value text)
returns text
language sql
stable
strict
set search_path = ''
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.lower(extensions.unaccent(pg_catalog.btrim(p_value))),
    '[[:space:]]+',
    '-',
    'g'
  );
$$;

create function private.alias_is_allowed(p_alias text)
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
    where v_letters = blocked.term
      or v_leet_letters = blocked.term
      or p_alias ~ (
        '(^|[_-])' || blocked.term || '([_-]|[0-9]|$)'
      )
      or v_leet_alias ~ (
        '(^|[_-])' || blocked.term || '([_-]|[0-9]|$)'
      )
  );
end;
$$;

revoke all on function private.normalize_person_name(text) from public, anon, authenticated;
revoke all on function private.normalize_alias(text) from public, anon, authenticated;
revoke all on function private.alias_is_allowed(text) from public, anon, authenticated;

create function private.prepare_and_validate_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operational_date date :=
    (pg_catalog.statement_timestamp() at time zone 'America/El_Salvador')::date;
  v_is_adult boolean;
begin
  if new.first_name is not null then
    new.first_name := private.normalize_person_name(new.first_name);
  end if;

  if new.last_name is not null then
    new.last_name := private.normalize_person_name(new.last_name);
  end if;

  if new.alias is not null then
    new.alias := private.normalize_alias(new.alias);
    new.display_name := new.alias;
  end if;

  if new.first_name is not null and (
    char_length(new.first_name) not between 1 and 80
    or new.first_name !~ '^[[:alpha:]][[:alpha:] ''’-]*$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'El nombre no es válido.';
  end if;

  if new.last_name is not null and (
    char_length(new.last_name) not between 1 and 80
    or new.last_name !~ '^[[:alpha:]][[:alpha:] ''’-]*$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'El apellido no es válido.';
  end if;

  if new.alias is not null and not private.alias_is_allowed(new.alias) then
    raise exception using
      errcode = '22023',
      message = 'El alias no está permitido.';
  end if;

  if new.birth_date is not null then
    if new.birth_date > v_operational_date then
      raise exception using
        errcode = '22023',
        message = 'La fecha de nacimiento no puede estar en el futuro.';
    end if;

    if new.age_declaration is not null then
      v_is_adult :=
        (new.birth_date + interval '18 years')::date <= v_operational_date;

      if (new.age_declaration = 'adult'::public.age_declaration) <> v_is_adult then
        raise exception using
          errcode = '22023',
          message = 'La declaración de edad no coincide con la fecha de nacimiento.';
      end if;
    end if;
  end if;

  if new.profile_completed_at is not null and (
    new.first_name is null
    or new.last_name is null
    or new.alias is null
    or new.birth_date is null
    or new.age_declaration is null
    or new.department is null
    or new.avatar_id is null
    or new.rules_accepted_at is null
    or new.privacy_accepted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'El perfil obligatorio está incompleto.';
  end if;

  if tg_op = 'UPDATE' and old.profile_completed_at is not null and (
    new.birth_date is distinct from old.birth_date
    or new.age_declaration is distinct from old.age_declaration
    or new.rules_accepted_at is distinct from old.rules_accepted_at
    or new.privacy_accepted_at is distinct from old.privacy_accepted_at
    or new.profile_completed_at is distinct from old.profile_completed_at
  ) then
    raise exception using
      errcode = '42501',
      message = 'Los datos históricos del registro no se pueden modificar.';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_and_validate_profile() from public, anon, authenticated;

create trigger profiles_prepare_and_validate
before insert or update on public.profiles
for each row
execute function private.prepare_and_validate_profile();

-- Replace the foundation handler in place. Auth metadata supplies profile data
-- only; authorization is always created independently as participant.
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
  if v_metadata ?| array['role', 'points', 'disciplinary_status'] then
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
    v_registered_at,
    v_registered_at,
    v_registered_at
  );

  insert into private.user_roles (user_id, role)
  values (new.id, 'participant'::public.app_role);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Profile changes are deliberately funneled through narrow RPCs. Keeping the
-- existing RLS update policy is harmless without table UPDATE privileges and
-- remains defense in depth for future column grants.
revoke update on table public.profiles from authenticated;
revoke update (display_name) on table public.profiles from authenticated;

create function public.is_alias_available(p_alias text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_alias text;
begin
  if p_alias is null then
    return false;
  end if;

  v_alias := private.normalize_alias(p_alias);

  if not private.alias_is_allowed(v_alias) then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles as profiles
    where pg_catalog.lower(profiles.alias) = pg_catalog.lower(v_alias)
  );
end;
$$;

comment on function public.is_alias_available(text) is
  'Prevalidación de UX; el índice único sigue siendo la autoridad ante carreras.';

revoke all on function public.is_alias_available(text) from public;
grant execute on function public.is_alias_available(text) to anon, authenticated;

create function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_alias text,
  p_department text,
  p_avatar_id text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_department public.elsalvador_department;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Se requiere una sesión autenticada.';
  end if;

  begin
    v_department := p_department::public.elsalvador_department;
  exception
    when invalid_text_representation then
      raise exception using
        errcode = '22023',
        message = 'El departamento no es válido.';
  end;

  update public.profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    alias = p_alias,
    department = v_department,
    avatar_id = p_avatar_id
  where id = (select auth.uid())
    and profile_completed_at is not null
  returning * into v_profile;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'No existe un perfil completo para la sesión.';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text) to authenticated;

-- This RPC lets users backfilled by the foundation migration complete their
-- legacy empty profile once. New registrations are already complete.
create function public.complete_my_profile(
  p_first_name text,
  p_last_name text,
  p_alias text,
  p_birth_date text,
  p_age_declaration text,
  p_department text,
  p_avatar_id text,
  p_accepted_rules boolean,
  p_accepted_privacy boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_birth_date date;
  v_age_declaration public.age_declaration;
  v_department public.elsalvador_department;
  v_completed_at timestamptz := pg_catalog.statement_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Se requiere una sesión autenticada.';
  end if;

  if p_accepted_rules is not true or p_accepted_privacy is not true then
    raise exception using
      errcode = '22023',
      message = 'Debe aceptar las reglas y la política de privacidad.';
  end if;

  select *
  into v_profile
  from public.profiles as profiles
  where profiles.id = (select auth.uid())
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'No existe un perfil para la sesión.';
  end if;

  -- A retry after a lost response is safe and does not rewrite audit fields.
  if v_profile.profile_completed_at is not null then
    return v_profile;
  end if;

  if coalesce(p_birth_date, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using
      errcode = '22023',
      message = 'La fecha de nacimiento no es válida.';
  end if;

  begin
    v_birth_date := p_birth_date::date;
    v_age_declaration := p_age_declaration::public.age_declaration;
    v_department := p_department::public.elsalvador_department;
  exception
    when invalid_text_representation or datetime_field_overflow then
      raise exception using
        errcode = '22023',
        message = 'Los datos del perfil no son válidos.';
  end;

  update public.profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    alias = p_alias,
    birth_date = v_birth_date,
    age_declaration = v_age_declaration,
    department = v_department,
    avatar_id = p_avatar_id,
    rules_accepted_at = v_completed_at,
    privacy_accepted_at = v_completed_at,
    profile_completed_at = v_completed_at
  where id = (select auth.uid())
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.complete_my_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) from public, anon;
grant execute on function public.complete_my_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;

-- The bootstrap is one-shot and auditable. It is callable only with the
-- isolated service-role/secret key and never from the web runtime.
create table private.bootstrap_state (
  singleton boolean primary key default true check (singleton),
  first_superadmin_user_id uuid,
  completed_at timestamptz
);

create table private.role_audit_log (
  id bigint generated always as identity primary key,
  target_user_id uuid not null,
  previous_role public.app_role not null,
  new_role public.app_role not null,
  actor_database_role text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table private.bootstrap_state enable row level security;
alter table private.role_audit_log enable row level security;
revoke all on table private.bootstrap_state from public, anon, authenticated;
revoke all on table private.role_audit_log from public, anon, authenticated;
revoke all on sequence private.role_audit_log_id_seq from public, anon, authenticated;

insert into private.bootstrap_state (
  singleton,
  first_superadmin_user_id,
  completed_at
)
select
  true,
  roles.user_id,
  roles.updated_at
from private.user_roles as roles
where roles.role = 'superadmin'::public.app_role
order by roles.created_at, roles.user_id
limit 1;

insert into private.bootstrap_state (singleton)
values (true)
on conflict (singleton) do nothing;

create function public.bootstrap_first_superadmin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_previous_role public.app_role;
  v_bootstrap_user_id uuid;
  v_completed_at timestamptz;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Esta operación requiere la credencial administrativa aislada.';
  end if;

  if p_email is null or p_email <> pg_catalog.btrim(p_email) then
    raise exception using
      errcode = '22023',
      message = 'El correo objetivo no es válido.';
  end if;

  select users.id
  into v_target_user_id
  from auth.users as users
  where pg_catalog.lower(users.email) = pg_catalog.lower(p_email)
    and users.email_confirmed_at is not null;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'No existe un usuario confirmado con ese correo.';
  end if;

  select state.first_superadmin_user_id, state.completed_at
  into v_bootstrap_user_id, v_completed_at
  from private.bootstrap_state as state
  where state.singleton
  for update;

  if v_completed_at is not null then
    if v_bootstrap_user_id = v_target_user_id and exists (
      select 1
      from private.user_roles as roles
      where roles.user_id = v_target_user_id
        and roles.role = 'superadmin'::public.app_role
    ) then
      return v_target_user_id;
    end if;

    raise exception using
      errcode = '55000',
      message = 'El primer superadmin ya fue inicializado.';
  end if;

  if exists (
    select 1
    from private.user_roles as roles
    where roles.role = 'superadmin'::public.app_role
  ) then
    raise exception using
      errcode = '55000',
      message = 'Existe un superadmin y el estado de bootstrap es inconsistente.';
  end if;

  if not exists (
    select 1
    from public.profiles as profiles
    where profiles.id = v_target_user_id
      and profiles.profile_completed_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'El usuario debe completar su perfil antes del bootstrap.';
  end if;

  select roles.role
  into v_previous_role
  from private.user_roles as roles
  where roles.user_id = v_target_user_id
  for update;

  if v_previous_role is distinct from 'participant'::public.app_role then
    raise exception using
      errcode = '55000',
      message = 'El usuario objetivo no tiene el rol participant esperado.';
  end if;

  update private.user_roles
  set role = 'superadmin'::public.app_role
  where user_id = v_target_user_id;

  insert into private.role_audit_log (
    target_user_id,
    previous_role,
    new_role,
    actor_database_role,
    reason
  )
  values (
    v_target_user_id,
    v_previous_role,
    'superadmin'::public.app_role,
    (select auth.role()),
    'Bootstrap inicial y único del primer superadmin'
  );

  update private.bootstrap_state
  set
    first_superadmin_user_id = v_target_user_id,
    completed_at = pg_catalog.statement_timestamp()
  where singleton;

  return v_target_user_id;
end;
$$;

comment on function public.bootstrap_first_superadmin(text) is
  'Bootstrap idempotente y de un solo uso para un participant confirmado y con perfil completo.';

revoke all on function public.bootstrap_first_superadmin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_first_superadmin(text) to service_role;

commit;
