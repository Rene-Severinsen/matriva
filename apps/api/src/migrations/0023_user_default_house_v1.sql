alter table user_profiles
  add column if not exists default_house_id text references houses(id) on delete set null;

create index if not exists user_profiles_default_house_id_idx
  on user_profiles (default_house_id)
  where default_house_id is not null;
