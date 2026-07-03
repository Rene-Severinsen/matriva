create table dev_users (
  id text primary key,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dev_users_id_shape check (id ~ '^usr_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint dev_users_email_lowercase check (email = lower(email))
);

create table houses (
  id text primary key,
  dev_user_id text not null references dev_users(id) on delete cascade,
  address_label text not null,
  dawa_address_id text,
  source_access_address_id text,
  status text not null default 'saved',
  data_confidence text not null default 'not_verified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint houses_id_shape check (id ~ '^house_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint houses_status_valid check (status in ('saved')),
  constraint houses_data_confidence_valid check (data_confidence in ('not_verified'))
);

create index houses_dev_user_id_created_at_idx
  on houses (dev_user_id, created_at desc);

create table maintenance_tasks (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  title text not null,
  description text,
  source text not null,
  status text not null,
  timing_type text not null,
  due_date date,
  season text,
  recommendation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint maintenance_tasks_id_shape check (id ~ '^task_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint maintenance_tasks_source_valid check (
    source in ('user_created', 'matriva_recommended')
  ),
  constraint maintenance_tasks_status_valid check (
    status in ('suggested', 'planned', 'due', 'overdue', 'done', 'dismissed', 'rescheduled')
  ),
  constraint maintenance_tasks_timing_type_valid check (
    timing_type in ('specific_deadline', 'seasonal_window', 'none')
  ),
  constraint maintenance_tasks_season_valid check (
    season is null or season in ('spring', 'summer', 'autumn', 'winter', 'all_year')
  ),
  constraint maintenance_tasks_timing_shape check (
    (
      timing_type = 'specific_deadline'
      and due_date is not null
      and season is null
    )
    or (
      timing_type = 'seasonal_window'
      and due_date is null
      and season is not null
    )
    or (
      timing_type = 'none'
      and due_date is null
      and season is null
    )
  ),
  constraint maintenance_tasks_completed_shape check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  ),
  constraint maintenance_tasks_recommendation_source check (
    source = 'matriva_recommended' or recommendation is null
  )
);

create index maintenance_tasks_house_id_created_at_idx
  on maintenance_tasks (house_id, created_at desc);
