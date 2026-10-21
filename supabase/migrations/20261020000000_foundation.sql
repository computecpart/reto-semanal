begin;

create type public.app_role as enum ('participant', 'admin', 'superadmin');

create schema private;

revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_valid check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 100
    )
  )
);

comment on table public.profiles is
  'Datos editables del participante. Los roles se almacenan por separado.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create table private.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'participant'::public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.user_roles is
  'Fuente confiable de autorización. Nunca se deriva de user_metadata.';

alter table private.user_roles enable row level security;

revoke all on table private.user_roles from public, anon, authenticated;
revoke all on type public.app_role from public, anon;
grant usage on type public.app_role to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

create trigger user_roles_set_updated_at
before update on private.user_roles
for each row
execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);

  insert into private.user_roles (user_id, role)
  values (new.id, 'participant'::public.app_role);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

-- A project may already contain Auth users when this first migration is applied.
-- They start with the least-privileged role; promotion is a separate controlled act.
insert into public.profiles (id)
select users.id
from auth.users as users
on conflict (id) do nothing;

insert into private.user_roles (user_id, role)
select users.id, 'participant'::public.app_role
from auth.users as users
on conflict (user_id) do nothing;

create function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select user_roles.role
  from private.user_roles
  where user_roles.user_id = (select auth.uid());
$$;

comment on function public.get_my_role() is
  'Devuelve únicamente el rol del usuario autenticado desde la tabla confiable.';

revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

commit;

