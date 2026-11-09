begin;

-- The avatar catalog grows from 24 to 36 original pixel-art designs.
alter table public.profiles drop constraint profiles_avatar_allowed;

alter table public.profiles
  add constraint profiles_avatar_allowed check (
    avatar_id is null
    or avatar_id ~ '^avatar-(0[1-9]|[12][0-9]|3[0-6])$'
  );

commit;
