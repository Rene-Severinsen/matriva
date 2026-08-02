alter table maintenance_completions
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by_user_id text references users(id) on delete set null;

alter table maintenance_tasks
  add column if not exists generated_from_completion_id text references maintenance_completions(id) on delete set null,
  add column if not exists restored_note_draft text,
  add column if not exists generated_state_fingerprint text;

drop index if exists maintenance_completions_task_once_idx;

create unique index maintenance_completions_task_active_once_idx
  on maintenance_completions (task_id)
  where reversed_at is null;

create index if not exists maintenance_completions_active_house_idx
  on maintenance_completions (house_id, completed_date desc, created_at desc)
  where reversed_at is null;

create index if not exists maintenance_tasks_generated_from_completion_idx
  on maintenance_tasks (generated_from_completion_id)
  where generated_from_completion_id is not null;

create unique index if not exists maintenance_tasks_generated_from_completion_unique_idx
  on maintenance_tasks (generated_from_completion_id)
  where generated_from_completion_id is not null;
