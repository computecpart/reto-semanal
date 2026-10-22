begin;

-- The avatar catalog grows from 12 to 24 original pixel-art designs.
alter table public.profiles drop constraint profiles_avatar_allowed;

alter table public.profiles
  add constraint profiles_avatar_allowed check (
    avatar_id is null
    or avatar_id ~ '^avatar-(0[1-9]|1[0-9]|2[0-4])$'
  );

commit;
