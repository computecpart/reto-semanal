begin;

-- eligible_count was null when every eligible participant was drawn
-- (array_length of an empty array). The total is now captured before drawing.
create or replace function public.admin_run_raffle(p_public_seed text, p_winners integer)
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
  v_total integer;
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

  v_total := pg_catalog.array_length(v_codes, 1);
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
    v_total,
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

revoke all on function public.admin_run_raffle(text, integer) from public, anon;
grant execute on function public.admin_run_raffle(text, integer) to authenticated;

commit;
