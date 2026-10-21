begin;

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Raises 42501 unless the caller holds one of the given roles. Every
-- administrative RPC calls it first.
create function private.require_role(variadic p_roles public.app_role[])
returns public.app_role
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Se requiere una sesión autenticada.';
  end if;

  select roles.role
  into v_role
  from private.user_roles as roles
  where roles.user_id = (select auth.uid());

  if v_role is null or not (v_role = any (p_roles)) then
    raise exception using
      errcode = '42501',
      message = 'No tienes permiso para esta operación.';
  end if;

  return v_role;
end;
$$;

revoke all on function private.require_role(public.app_role[]) from public, anon, authenticated;

-- Usable from RLS and Storage policies; only reveals the caller's own status.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select roles.role in ('admin'::public.app_role, 'superadmin'::public.app_role)
      from private.user_roles as roles
      where roles.user_id = (select auth.uid())
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'Este registro es inmutable.';
end;
$$;

revoke all on function private.forbid_mutation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit log (append-only, shared by every later phase)
-- ---------------------------------------------------------------------------

create table private.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role public.app_role,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null,
  entity_id text,
  campaign_id uuid,
  before jsonb,
  after jsonb,
  reason text
);

alter table private.audit_log enable row level security;
revoke all on table private.audit_log from public, anon, authenticated;
revoke all on sequence private.audit_log_id_seq from public, anon, authenticated;

create trigger audit_log_append_only
before update or delete on private.audit_log
for each row execute function private.forbid_mutation();

create trigger audit_log_no_truncate
before truncate on private.audit_log
for each statement execute function private.forbid_mutation();

create function private.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_campaign_id uuid,
  p_before jsonb,
  p_after jsonb,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.audit_log (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    campaign_id,
    before,
    after,
    reason
  )
  values (
    (select auth.uid()),
    (
      select roles.role
      from private.user_roles as roles
      where roles.user_id = (select auth.uid())
    ),
    p_action,
    p_entity_type,
    p_entity_id,
    p_campaign_id,
    p_before,
    p_after,
    p_reason
  );
end;
$$;

revoke all on function private.write_audit(text, text, text, uuid, jsonb, jsonb, text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

create type public.campaign_status as enum (
  'draft',
  'published',
  'closed',
  'finalized',
  'archived'
);

revoke all on type public.campaign_status from public, anon;
grant usage on type public.campaign_status to authenticated;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    char_length(slug) between 3 and 60
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  name text not null check (
    name = btrim(name) and char_length(name) between 3 and 120
  ),
  status public.campaign_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  prize_title text check (prize_title is null or char_length(prize_title) <= 160),
  prize_description text check (
    prize_description is null or char_length(prize_description) <= 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint campaigns_dates_ordered check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

comment on table public.campaigns is
  'Datos oficiales de cada campaña. La presentación pública vive en landing_pages.';

create unique index campaigns_single_published
on public.campaigns ((true))
where status = 'published';

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function private.set_updated_at();

alter table public.campaigns enable row level security;
revoke all on table public.campaigns from public, anon, authenticated;
grant select on table public.campaigns to authenticated;

create policy "campaigns_admin_read"
on public.campaigns
for select
to authenticated
using ((select public.is_admin()));

-- The campaign shown publicly: the published one, otherwise the most recent
-- closed or finalized one.
create function private.current_campaign_id()
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
    ),
    (
      select campaigns.id
      from public.campaigns as campaigns
      where campaigns.status in (
        'closed'::public.campaign_status,
        'finalized'::public.campaign_status
      )
      order by campaigns.ends_at desc nulls last, campaigns.updated_at desc
      limit 1
    )
  );
$$;

revoke all on function private.current_campaign_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Landing pages: section-based content with draft, publish and history
-- ---------------------------------------------------------------------------

create function private.landing_content_is_valid(p_content jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_content is not null
    and pg_catalog.jsonb_typeof(p_content) = 'object'
    and pg_catalog.jsonb_typeof(p_content -> 'sections') = 'array'
    and pg_catalog.jsonb_array_length(p_content -> 'sections') <= 30
    and pg_catalog.jsonb_typeof(coalesce(p_content -> 'theme', '{}'::jsonb)) = 'object'
    and pg_catalog.octet_length(p_content::text) <= 200000;
$$;

revoke all on function private.landing_content_is_valid(jsonb) from public, anon, authenticated;

create table public.landing_pages (
  campaign_id uuid primary key references public.campaigns (id) on delete cascade,
  draft jsonb not null default '{"theme": {}, "sections": []}'::jsonb,
  published jsonb,
  published_version integer not null default 0 check (published_version >= 0),
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid,
  published_at timestamptz,
  published_by uuid,
  constraint landing_pages_draft_valid check (private.landing_content_is_valid(draft)),
  constraint landing_pages_published_valid check (
    published is null or private.landing_content_is_valid(published)
  )
);

alter table public.landing_pages enable row level security;
revoke all on table public.landing_pages from public, anon, authenticated;
grant select on table public.landing_pages to authenticated;

create policy "landing_pages_admin_read"
on public.landing_pages
for select
to authenticated
using ((select public.is_admin()));

create table public.landing_page_versions (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null check (private.landing_content_is_valid(content)),
  published_at timestamptz not null default now(),
  published_by uuid,
  unique (campaign_id, version)
);

alter table public.landing_page_versions enable row level security;
revoke all on table public.landing_page_versions from public, anon, authenticated;
revoke all on sequence public.landing_page_versions_id_seq from public, anon, authenticated;
grant select on table public.landing_page_versions to authenticated;

create policy "landing_page_versions_admin_read"
on public.landing_page_versions
for select
to authenticated
using ((select public.is_admin()));

create trigger landing_page_versions_immutable
before update or delete on public.landing_page_versions
for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Versioned rules and acceptances
-- ---------------------------------------------------------------------------

create table public.campaign_rules_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  version integer not null check (version > 0),
  content_md text not null check (char_length(content_md) between 1 and 50000),
  change_summary text check (change_summary is null or char_length(change_summary) <= 500),
  is_major boolean not null default false,
  published_at timestamptz not null default now(),
  published_by uuid,
  unique (campaign_id, version)
);

alter table public.campaign_rules_versions enable row level security;
revoke all on table public.campaign_rules_versions from public, anon, authenticated;
grant select on table public.campaign_rules_versions to authenticated;

create policy "rules_versions_admin_read"
on public.campaign_rules_versions
for select
to authenticated
using ((select public.is_admin()));

create trigger campaign_rules_versions_immutable
before update or delete on public.campaign_rules_versions
for each row execute function private.forbid_mutation();

create table public.rules_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  rules_version_id uuid not null references public.campaign_rules_versions (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  primary key (user_id, rules_version_id)
);

alter table public.rules_acceptances enable row level security;
revoke all on table public.rules_acceptances from public, anon, authenticated;
grant select on table public.rules_acceptances to authenticated;

create policy "rules_acceptances_select_own"
on public.rules_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: public bucket for landing images, admin-only writes
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-assets',
  'landing-assets',
  true,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "landing_assets_admin_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'landing-assets' and (select public.is_admin()));

create policy "landing_assets_admin_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'landing-assets' and (select public.is_admin()))
with check (bucket_id = 'landing-assets' and (select public.is_admin()));

create policy "landing_assets_admin_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'landing-assets' and (select public.is_admin()));

create policy "landing_assets_admin_list"
on storage.objects
for select
to authenticated
using (bucket_id = 'landing-assets' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public read RPCs
-- ---------------------------------------------------------------------------

create function public.get_public_landing()
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
    'rules_version', (
      select max(rules.version)
      from public.campaign_rules_versions as rules
      where rules.campaign_id = campaigns.id
    )
  )
  from public.campaigns as campaigns
  left join public.landing_pages as landing on landing.campaign_id = campaigns.id
  where campaigns.id = private.current_campaign_id();
$$;

revoke all on function public.get_public_landing() from public;
grant execute on function public.get_public_landing() to anon, authenticated;

create function public.get_current_rules()
returns table (
  campaign_name text,
  version integer,
  content_md text,
  is_major boolean,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select campaigns.name, rules.version, rules.content_md, rules.is_major, rules.published_at
  from public.campaign_rules_versions as rules
  join public.campaigns as campaigns on campaigns.id = rules.campaign_id
  where rules.campaign_id = private.current_campaign_id()
  order by rules.version desc
  limit 1;
$$;

revoke all on function public.get_current_rules() from public;
grant execute on function public.get_current_rules() to anon, authenticated;

-- A user must have accepted a version at least as recent as the latest major
-- one. Version 1 always counts as major.
create function public.get_my_rules_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid := private.current_campaign_id();
  v_latest public.campaign_rules_versions;
  v_required_version integer;
  v_accepted_version integer;
begin
  if (select auth.uid()) is null or v_campaign_id is null then
    return pg_catalog.jsonb_build_object('required', false);
  end if;

  select *
  into v_latest
  from public.campaign_rules_versions as rules
  where rules.campaign_id = v_campaign_id
  order by rules.version desc
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('required', false);
  end if;

  select max(rules.version)
  into v_required_version
  from public.campaign_rules_versions as rules
  where rules.campaign_id = v_campaign_id
    and (rules.is_major or rules.version = 1);

  select max(rules.version)
  into v_accepted_version
  from public.rules_acceptances as acceptances
  join public.campaign_rules_versions as rules on rules.id = acceptances.rules_version_id
  where acceptances.user_id = (select auth.uid())
    and rules.campaign_id = v_campaign_id;

  return pg_catalog.jsonb_build_object(
    'required', coalesce(v_accepted_version, 0) < v_required_version,
    'latest_version', v_latest.version,
    'accepted_version', v_accepted_version
  );
end;
$$;

revoke all on function public.get_my_rules_status() from public, anon;
grant execute on function public.get_my_rules_status() to authenticated;

create function public.accept_current_rules()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules public.campaign_rules_versions;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Se requiere una sesión autenticada.';
  end if;

  select *
  into v_rules
  from public.campaign_rules_versions as rules
  where rules.campaign_id = private.current_campaign_id()
  order by rules.version desc
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'No hay reglas publicadas.';
  end if;

  insert into public.rules_acceptances (user_id, rules_version_id)
  values ((select auth.uid()), v_rules.id)
  on conflict do nothing;

  return v_rules.version;
end;
$$;

revoke all on function public.accept_current_rules() from public, anon;
grant execute on function public.accept_current_rules() to authenticated;

-- ---------------------------------------------------------------------------
-- Administrative RPCs (all audited in the same transaction)
-- ---------------------------------------------------------------------------

create function public.admin_create_campaign(
  p_name text,
  p_slug text,
  p_landing_draft jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
begin
  perform private.require_role('admin', 'superadmin');

  if not private.landing_content_is_valid(p_landing_draft) then
    raise exception using
      errcode = '22023',
      message = 'El contenido de la portada no es válido.';
  end if;

  insert into public.campaigns (name, slug, created_by, updated_by)
  values (p_name, p_slug, (select auth.uid()), (select auth.uid()))
  returning * into v_campaign;

  insert into public.landing_pages (campaign_id, draft, draft_updated_by)
  values (v_campaign.id, p_landing_draft, (select auth.uid()));

  perform private.write_audit(
    'campaign.create', 'campaign', v_campaign.id::text, v_campaign.id,
    null, pg_catalog.to_jsonb(v_campaign)
  );

  return v_campaign.id;
end;
$$;

create function public.admin_update_campaign(
  p_campaign_id uuid,
  p_name text,
  p_slug text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_prize_title text,
  p_prize_description text
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

  select * into v_before
  from public.campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  if v_before.status in ('finalized'::public.campaign_status, 'archived'::public.campaign_status) then
    raise exception using
      errcode = '55000',
      message = 'Una campaña finalizada o archivada no se puede editar.';
  end if;

  if v_before.status <> 'draft'::public.campaign_status
    and (p_starts_at is null or p_ends_at is null)
  then
    raise exception using
      errcode = '22023',
      message = 'Una campaña publicada necesita fechas de inicio y cierre.';
  end if;

  update public.campaigns
  set
    name = p_name,
    slug = p_slug,
    starts_at = p_starts_at,
    ends_at = p_ends_at,
    prize_title = nullif(pg_catalog.btrim(p_prize_title), ''),
    prize_description = nullif(pg_catalog.btrim(p_prize_description), ''),
    updated_by = (select auth.uid())
  where id = p_campaign_id
  returning * into v_after;

  perform private.write_audit(
    'campaign.update', 'campaign', p_campaign_id::text, p_campaign_id,
    pg_catalog.to_jsonb(v_before), pg_catalog.to_jsonb(v_after)
  );
end;
$$;

create function public.admin_set_campaign_status(
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

    if exists (
      select 1 from public.campaigns as campaigns
      where campaigns.status = 'published'::public.campaign_status
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

create function public.admin_save_landing_draft(p_campaign_id uuid, p_draft jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  if not private.landing_content_is_valid(p_draft) then
    raise exception using
      errcode = '22023',
      message = 'El contenido de la portada no es válido.';
  end if;

  update public.landing_pages
  set
    draft = p_draft,
    draft_updated_at = pg_catalog.statement_timestamp(),
    draft_updated_by = (select auth.uid())
  where campaign_id = p_campaign_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;
end;
$$;

create function public.admin_publish_landing(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landing public.landing_pages;
  v_version integer;
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_landing
  from public.landing_pages
  where campaign_id = p_campaign_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  v_version := v_landing.published_version + 1;

  insert into public.landing_page_versions (campaign_id, version, content, published_by)
  values (p_campaign_id, v_version, v_landing.draft, (select auth.uid()));

  update public.landing_pages
  set
    published = v_landing.draft,
    published_version = v_version,
    published_at = pg_catalog.statement_timestamp(),
    published_by = (select auth.uid())
  where campaign_id = p_campaign_id;

  perform private.write_audit(
    'landing.publish', 'landing_page', p_campaign_id::text, p_campaign_id,
    pg_catalog.jsonb_build_object('version', v_landing.published_version),
    pg_catalog.jsonb_build_object('version', v_version)
  );

  return v_version;
end;
$$;

-- Copies a historical version into the draft; publishing stays explicit.
create function public.admin_restore_landing_version(p_campaign_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content jsonb;
begin
  perform private.require_role('admin', 'superadmin');

  select versions.content into v_content
  from public.landing_page_versions as versions
  where versions.campaign_id = p_campaign_id and versions.version = p_version;

  if not found then
    raise exception using errcode = 'P0002', message = 'La versión no existe.';
  end if;

  update public.landing_pages
  set
    draft = v_content,
    draft_updated_at = pg_catalog.statement_timestamp(),
    draft_updated_by = (select auth.uid())
  where campaign_id = p_campaign_id;

  perform private.write_audit(
    'landing.restore_draft', 'landing_page', p_campaign_id::text, p_campaign_id,
    null, pg_catalog.jsonb_build_object('from_version', p_version)
  );
end;
$$;

create function public.admin_publish_rules(
  p_campaign_id uuid,
  p_content_md text,
  p_change_summary text,
  p_is_major boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  perform private.require_role('admin', 'superadmin');

  perform 1 from public.campaigns where id = p_campaign_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La campaña no existe.';
  end if;

  select coalesce(max(rules.version), 0) + 1 into v_version
  from public.campaign_rules_versions as rules
  where rules.campaign_id = p_campaign_id;

  insert into public.campaign_rules_versions (
    campaign_id, version, content_md, change_summary, is_major, published_by
  )
  values (
    p_campaign_id,
    v_version,
    p_content_md,
    nullif(pg_catalog.btrim(p_change_summary), ''),
    coalesce(p_is_major, false) or v_version = 1,
    (select auth.uid())
  );

  perform private.write_audit(
    'rules.publish', 'campaign_rules', p_campaign_id::text, p_campaign_id,
    null,
    pg_catalog.jsonb_build_object(
      'version', v_version,
      'is_major', coalesce(p_is_major, false) or v_version = 1,
      'change_summary', p_change_summary
    )
  );

  return v_version;
end;
$$;

revoke all on function public.admin_create_campaign(text, text, jsonb) from public, anon;
revoke all on function public.admin_update_campaign(uuid, text, text, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.admin_set_campaign_status(uuid, public.campaign_status, text) from public, anon;
revoke all on function public.admin_save_landing_draft(uuid, jsonb) from public, anon;
revoke all on function public.admin_publish_landing(uuid) from public, anon;
revoke all on function public.admin_restore_landing_version(uuid, integer) from public, anon;
revoke all on function public.admin_publish_rules(uuid, text, text, boolean) from public, anon;

grant execute on function public.admin_create_campaign(text, text, jsonb) to authenticated;
grant execute on function public.admin_update_campaign(uuid, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.admin_set_campaign_status(uuid, public.campaign_status, text) to authenticated;
grant execute on function public.admin_save_landing_draft(uuid, jsonb) to authenticated;
grant execute on function public.admin_publish_landing(uuid) to authenticated;
grant execute on function public.admin_restore_landing_version(uuid, integer) to authenticated;
grant execute on function public.admin_publish_rules(uuid, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up records acceptance of the rules version in force
-- ---------------------------------------------------------------------------

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
