begin;

-- The one-argument unaccent(text) resolves its dictionary through search_path.
-- Every function here pins search_path = '', so that form fails at runtime with
-- "text search dictionary "unaccent" does not exist". The two-argument form with
-- a schema-qualified dictionary is independent of search_path.
create or replace function private.normalize_alias(p_value text)
returns text
language sql
stable
strict
set search_path = ''
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.lower(
      extensions.unaccent(
        'extensions.unaccent'::pg_catalog.regdictionary,
        pg_catalog.btrim(p_value)
      )
    ),
    '[[:space:]]+',
    '-',
    'g'
  );
$$;

revoke all on function private.normalize_alias(text) from public, anon, authenticated;

commit;
