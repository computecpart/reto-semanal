begin;

-- ===========================================================================
-- Missions (rewards redeemable with a staff-provided code or its QR link)
-- ===========================================================================

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  name text not null check (name = btrim(name) and char_length(name) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  points integer not null check (points between 1 and 100000),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint rewards_window check (expires_at > starts_at)
);

create index rewards_campaign on public.rewards (campaign_id, starts_at);

create trigger rewards_set_updated_at
before update on public.rewards
for each row execute function private.set_updated_at();

-- One active code per mission. Stored normalized: 8 symbols, no dashes.
create table private.reward_codes (
  reward_id uuid primary key references public.rewards (id) on delete cascade,
  code text not null unique check (code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  created_at timestamptz not null default now()
);

-- Manual code and QR are the same mission: one redemption per person.
create table public.reward_redemptions (
  id bigint generated always as identity primary key,
  reward_id uuid not null references public.rewards (id) on delete restrict,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  channel text not null check (channel in ('manual', 'qr')),
  redeemed_at timestamptz not null default now(),
  unique (user_id, reward_id)
);

create table private.redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

create index redeem_attempts_recent on private.redeem_attempts (user_id, attempted_at desc);

alter table public.rewards enable row level security;
alter table private.reward_codes enable row level security;
alter table public.reward_redemptions enable row level security;
alter table private.redeem_attempts enable row level security;

revoke all on table public.rewards from public, anon, authenticated;
revoke all on table private.reward_codes from public, anon, authenticated;
revoke all on table public.reward_redemptions from public, anon, authenticated;
revoke all on table private.redeem_attempts from public, anon, authenticated;
revoke all on sequence public.reward_redemptions_id_seq from public, anon, authenticated;
revoke all on sequence private.redeem_attempts_id_seq from public, anon, authenticated;

grant select on table public.rewards to authenticated;
grant select on table public.reward_redemptions to authenticated;

create policy "rewards_admin_read" on public.rewards
for select to authenticated using ((select public.is_admin()));

create policy "reward_redemptions_admin_read" on public.reward_redemptions
for select to authenticated using ((select public.is_admin()));

create policy "reward_redemptions_select_own" on public.reward_redemptions
for select to authenticated using ((select auth.uid()) = user_id);

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- 8 symbols from a 31-symbol alphabet without ambiguous glyphs (0/O, 1/I/L).
-- Rejection sampling (bytes >= 248 are discarded) keeps the draw unbiased.
create function private.new_reward_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
  v_byte integer;
  v_bytes bytea;
  v_index integer;
begin
  while char_length(v_code) < 8 loop
    v_bytes := extensions.gen_random_bytes(16);

    for v_index in 0..15 loop
      v_byte := pg_catalog.get_byte(v_bytes, v_index);

      if v_byte < 248 and char_length(v_code) < 8 then
        v_code := v_code || pg_catalog.substr(v_alphabet, (v_byte % 31) + 1, 1);
      end if;
    end loop;
  end loop;

  return v_code;
end;
$$;

create function private.normalize_reward_code(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_value, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

revoke all on function private.new_reward_code() from public, anon, authenticated;
revoke all on function private.normalize_reward_code(text) from public, anon, authenticated;

-- True after 10 failed codes in 10 minutes (brute-force limit).
create function private.redeem_rate_limited(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= 10
  from private.redeem_attempts as attempts
  where attempts.user_id = p_user_id
    and not attempts.success
    and attempts.attempted_at > pg_catalog.statement_timestamp() - interval '10 minutes';
$$;

revoke all on function private.redeem_rate_limited(uuid) from public, anon, authenticated;

-- ===========================================================================
-- Participant RPCs: failures are returned (not raised) so the attempt log
-- that powers the brute-force limit is persisted.
-- ===========================================================================

create function public.preview_reward(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.rewards;
  v_now timestamptz := pg_catalog.statement_timestamp();
begin
  if v_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Inicia sesión para canjear.');
  end if;

  if private.redeem_rate_limited(v_user_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Demasiados intentos. Espera unos minutos.');
  end if;

  select rewards.* into v_reward
  from private.reward_codes as codes
  join public.rewards as rewards on rewards.id = codes.reward_id
  where codes.code = private.normalize_reward_code(p_code)
    and rewards.campaign_id = private.current_campaign_id();

  if not found then
    insert into private.redeem_attempts (user_id, success) values (v_user_id, false);
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Código no válido.');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reward', pg_catalog.jsonb_build_object(
      'name', v_reward.name,
      'description', v_reward.description,
      'points', v_reward.points,
      'starts_at', v_reward.starts_at,
      'expires_at', v_reward.expires_at,
      'state', case
        when exists (
          select 1 from public.reward_redemptions
          where reward_id = v_reward.id and user_id = v_user_id
        ) then 'redeemed'
        when not v_reward.enabled then 'disabled'
        when v_now < v_reward.starts_at then 'not_started'
        when v_now >= v_reward.expires_at then 'expired'
        else 'available'
      end
    )
  );
end;
$$;

create function public.redeem_reward(p_code text, p_channel text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reward public.rewards;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_inserted integer;
begin
  if v_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Inicia sesión para canjear.');
  end if;

  if p_channel not in ('manual', 'qr') then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Canal no válido.');
  end if;

  if private.redeem_rate_limited(v_user_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Demasiados intentos. Espera unos minutos.');
  end if;

  select rewards.* into v_reward
  from private.reward_codes as codes
  join public.rewards as rewards on rewards.id = codes.reward_id
  where codes.code = private.normalize_reward_code(p_code)
    and rewards.campaign_id = private.current_campaign_id()
  for update of rewards;

  if not found then
    insert into private.redeem_attempts (user_id, success) values (v_user_id, false);
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Código no válido.');
  end if;

  if not private.is_competitor(v_user_id) or not private.participant_can_earn(v_user_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Tu cuenta no puede sumar puntos.');
  end if;

  if not v_reward.enabled then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Esta misión no está activa.');
  end if;

  if v_now < v_reward.starts_at then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Esta misión aún no ha comenzado.');
  end if;

  if v_now >= v_reward.expires_at then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Esta misión ya venció.');
  end if;

  if not private.campaign_accepting_points(v_reward.campaign_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'La campaña no está recibiendo puntuaciones.');
  end if;

  insert into public.reward_redemptions (reward_id, campaign_id, user_id, channel)
  values (v_reward.id, v_reward.campaign_id, v_user_id, p_channel)
  on conflict (user_id, reward_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'message', 'Ya canjeaste esta misión.');
  end if;

  perform private.award_points(
    v_reward.campaign_id, v_user_id, v_reward.points, 'mission'::public.point_event_kind,
    'reward', v_reward.id::text, pg_catalog.left('Misión: ' || v_reward.name, 200), 0, true
  );

  insert into private.redeem_attempts (user_id, success) values (v_user_id, true);

  return pg_catalog.jsonb_build_object('ok', true, 'name', v_reward.name, 'points', v_reward.points);
end;
$$;

revoke all on function public.preview_reward(text) from public, anon;
revoke all on function public.redeem_reward(text, text) from public, anon;
grant execute on function public.preview_reward(text) to authenticated;
grant execute on function public.redeem_reward(text, text) to authenticated;

-- ===========================================================================
-- Administrative RPCs
-- ===========================================================================

create function public.admin_save_reward(
  p_reward_id uuid,
  p_name text,
  p_description text,
  p_points integer,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.rewards;
  v_after public.rewards;
  v_campaign_id uuid;
begin
  perform private.require_role('admin', 'superadmin');

  if p_reward_id is null then
    v_campaign_id := private.current_campaign_id();

    if v_campaign_id is null then
      raise exception using errcode = '55000', message = 'Crea y publica una campaña antes de crear misiones.';
    end if;

    insert into public.rewards (
      campaign_id, name, description, points, starts_at, expires_at, enabled, created_by, updated_by
    )
    values (
      v_campaign_id, pg_catalog.btrim(p_name), coalesce(pg_catalog.btrim(p_description), ''), p_points,
      p_starts_at, p_expires_at, coalesce(p_enabled, true), (select auth.uid()), (select auth.uid())
    )
    returning * into v_after;

    insert into private.reward_codes (reward_id, code) values (v_after.id, private.new_reward_code());

    perform private.write_audit(
      'reward.create', 'reward', v_after.id::text, v_after.campaign_id, null, pg_catalog.to_jsonb(v_after)
    );

    return v_after.id;
  end if;

  select * into v_before from public.rewards where id = p_reward_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La misión no existe.';
  end if;

  if p_points is distinct from v_before.points
    and exists (select 1 from public.reward_redemptions where reward_id = p_reward_id) then
    raise exception using errcode = '55000', message = 'Ya hay canjes: crea otra misión para cambiar los puntos.';
  end if;

  update public.rewards
  set
    name = pg_catalog.btrim(p_name),
    description = coalesce(pg_catalog.btrim(p_description), ''),
    points = p_points,
    starts_at = p_starts_at,
    expires_at = p_expires_at,
    enabled = coalesce(p_enabled, true),
    updated_by = (select auth.uid())
  where id = p_reward_id
  returning * into v_after;

  perform private.write_audit(
    'reward.update', 'reward', p_reward_id::text, v_after.campaign_id,
    pg_catalog.to_jsonb(v_before), pg_catalog.to_jsonb(v_after)
  );

  return p_reward_id;
end;
$$;

-- A leaked code is replaced; the old one stops working immediately.
create function public.admin_regenerate_reward_code(p_reward_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reward public.rewards;
  v_code text := private.new_reward_code();
begin
  perform private.require_role('admin', 'superadmin');

  select * into v_reward from public.rewards where id = p_reward_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La misión no existe.';
  end if;

  insert into private.reward_codes (reward_id, code)
  values (p_reward_id, v_code)
  on conflict (reward_id) do update set code = excluded.code, created_at = pg_catalog.statement_timestamp();

  perform private.write_audit(
    'reward.code_regenerate', 'reward', p_reward_id::text, v_reward.campaign_id, null, null
  );

  return v_code;
end;
$$;

create function public.admin_list_rewards()
returns table (
  id uuid,
  name text,
  points integer,
  starts_at timestamptz,
  expires_at timestamptz,
  enabled boolean,
  code text,
  redemption_count bigint
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
    rewards.id,
    rewards.name,
    rewards.points,
    rewards.starts_at,
    rewards.expires_at,
    rewards.enabled,
    codes.code,
    (select count(*) from public.reward_redemptions as redemptions where redemptions.reward_id = rewards.id)
  from public.rewards as rewards
  left join private.reward_codes as codes on codes.reward_id = rewards.id
  where rewards.campaign_id = private.current_campaign_id()
  order by rewards.starts_at desc;
end;
$$;

create function public.admin_get_reward(p_reward_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin', 'superadmin');

  return (
    select pg_catalog.to_jsonb(rewards) || pg_catalog.jsonb_build_object(
      'code', codes.code,
      'redemptions', coalesce((
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'alias', profiles.alias,
            'full_name', profiles.first_name || ' ' || profiles.last_name,
            'passport_code', profiles.passport_code,
            'channel', redemptions.channel,
            'redeemed_at', redemptions.redeemed_at
          )
          order by redemptions.redeemed_at desc
        )
        from public.reward_redemptions as redemptions
        join public.profiles as profiles on profiles.id = redemptions.user_id
        where redemptions.reward_id = rewards.id
      ), '[]'::jsonb)
    )
    from public.rewards as rewards
    left join private.reward_codes as codes on codes.reward_id = rewards.id
    where rewards.id = p_reward_id
  );
end;
$$;

revoke all on function public.admin_save_reward(uuid, text, text, integer, timestamptz, timestamptz, boolean) from public, anon;
revoke all on function public.admin_regenerate_reward_code(uuid) from public, anon;
revoke all on function public.admin_list_rewards() from public, anon;
revoke all on function public.admin_get_reward(uuid) from public, anon;
grant execute on function public.admin_save_reward(uuid, text, text, integer, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.admin_regenerate_reward_code(uuid) to authenticated;
grant execute on function public.admin_list_rewards() to authenticated;
grant execute on function public.admin_get_reward(uuid) to authenticated;

commit;
