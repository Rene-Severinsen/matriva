alter table user_profiles
  add column if not exists prompt_for_completion_note boolean not null default true;
