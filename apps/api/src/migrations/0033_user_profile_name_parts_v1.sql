alter table user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

alter table user_profiles
  drop constraint if exists user_profiles_first_name_not_blank,
  drop constraint if exists user_profiles_last_name_not_blank;

alter table user_profiles
  add constraint user_profiles_first_name_not_blank check (
    first_name is null or length(btrim(first_name)) > 0
  ),
  add constraint user_profiles_last_name_not_blank check (
    last_name is null or length(btrim(last_name)) > 0
  );
