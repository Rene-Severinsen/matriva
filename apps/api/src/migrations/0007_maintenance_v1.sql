alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_source_valid;

alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_recommendation_source;

alter table maintenance_tasks
  add constraint maintenance_tasks_source_valid check (
    source in ('user_created', 'matriva_recommended', 'recommendation_accepted')
  );

alter table maintenance_tasks
  add constraint maintenance_tasks_recommendation_source check (
    source in ('matriva_recommended', 'recommendation_accepted') or recommendation is null
  );

alter table maintenance_tasks
  add column if not exists user_id text references users(id) on delete cascade,
  add column if not exists recommendation_id text,
  add column if not exists recurrence_interval text,
  add column if not exists recurrence_anchor text,
  add column if not exists component_key text,
  add column if not exists price_amount_minor bigint,
  add column if not exists price_currency text not null default 'DKK',
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

update maintenance_tasks mt
set user_id = h.user_id
from houses h
where mt.house_id = h.id
  and mt.user_id is null
  and h.user_id is not null;

alter table maintenance_tasks
  add constraint maintenance_tasks_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'monthly',
      'quarterly',
      'half_yearly',
      'yearly',
      'every_2_years',
      'every_3_years',
      'every_5_years',
      'every_10_years'
    )
  );

alter table maintenance_tasks
  add constraint maintenance_tasks_recurrence_anchor_valid check (
    recurrence_anchor is null or recurrence_anchor in ('completed_date', 'fixed_calendar')
  );

alter table maintenance_tasks
  add constraint maintenance_tasks_recurrence_shape check (
    (recurrence_interval is null and recurrence_anchor is null)
    or (recurrence_interval is not null and recurrence_anchor is not null)
  );

alter table maintenance_tasks
  add constraint maintenance_tasks_price_valid check (
    price_amount_minor is null
    or (price_amount_minor >= 0 and price_amount_minor <= 999999999999)
  );

alter table maintenance_tasks
  add constraint maintenance_tasks_price_currency_valid check (
    price_currency = 'DKK'
  );

create index if not exists maintenance_tasks_house_active_idx
  on maintenance_tasks (house_id, due_date, created_at desc)
  where archived_at is null and deleted_at is null and status <> 'done';

create index if not exists maintenance_tasks_user_created_at_idx
  on maintenance_tasks (user_id, created_at desc);

create table maintenance_recommendations (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  source_type text not null,
  status text not null default 'pending',
  title text not null,
  description text not null,
  recommended_timing_label text not null,
  timing_type text not null,
  due_date date,
  season text,
  recurrence_interval text,
  recurrence_anchor text,
  component_key text,
  provenance jsonb not null default '{}'::jsonb,
  recommendation_key text not null,
  version_key text not null,
  accepted_task_id text references maintenance_tasks(id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_recommendations_id_shape check (
    id ~ '^mrec_[a-z0-9][a-z0-9_-]{7,63}$'
  ),
  constraint maintenance_recommendations_source_type_valid check (
    source_type in ('matriva_catalog', 'document_extracted', 'warranty_derived')
  ),
  constraint maintenance_recommendations_status_valid check (
    status in ('pending', 'accepted', 'dismissed')
  ),
  constraint maintenance_recommendations_timing_type_valid check (
    timing_type in ('specific_deadline', 'seasonal_window', 'none')
  ),
  constraint maintenance_recommendations_season_valid check (
    season is null or season in ('spring', 'summer', 'autumn', 'winter', 'all_year')
  ),
  constraint maintenance_recommendations_timing_shape check (
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
  constraint maintenance_recommendations_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'monthly',
      'quarterly',
      'half_yearly',
      'yearly',
      'every_2_years',
      'every_3_years',
      'every_5_years',
      'every_10_years'
    )
  ),
  constraint maintenance_recommendations_recurrence_anchor_valid check (
    recurrence_anchor is null or recurrence_anchor in ('completed_date', 'fixed_calendar')
  ),
  constraint maintenance_recommendations_recurrence_shape check (
    (recurrence_interval is null and recurrence_anchor is null)
    or (recurrence_interval is not null and recurrence_anchor is not null)
  ),
  constraint maintenance_recommendations_accept_shape check (
    (status = 'accepted' and accepted_task_id is not null)
    or (status <> 'accepted')
  ),
  constraint maintenance_recommendations_dismiss_shape check (
    (status = 'dismissed' and dismissed_at is not null)
    or (status <> 'dismissed')
  )
);

create unique index maintenance_recommendations_house_version_idx
  on maintenance_recommendations (house_id, version_key);

create index maintenance_recommendations_house_pending_idx
  on maintenance_recommendations (house_id, created_at desc)
  where status = 'pending';

create table maintenance_completions (
  id text primary key,
  task_id text not null references maintenance_tasks(id) on delete restrict,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  title_snapshot text not null,
  note text,
  completed_date date not null,
  price_amount_minor bigint,
  price_currency text not null default 'DKK',
  component_key text,
  source text not null,
  recurrence_interval text,
  recurrence_anchor text,
  created_at timestamptz not null default now(),
  constraint maintenance_completions_id_shape check (
    id ~ '^mcomp_[a-z0-9][a-z0-9_-]{7,63}$'
  ),
  constraint maintenance_completions_source_valid check (
    source in ('user_created', 'matriva_recommended', 'recommendation_accepted')
  ),
  constraint maintenance_completions_price_valid check (
    price_amount_minor is null
    or (price_amount_minor >= 0 and price_amount_minor <= 999999999999)
  ),
  constraint maintenance_completions_price_currency_valid check (
    price_currency = 'DKK'
  ),
  constraint maintenance_completions_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'monthly',
      'quarterly',
      'half_yearly',
      'yearly',
      'every_2_years',
      'every_3_years',
      'every_5_years',
      'every_10_years'
    )
  ),
  constraint maintenance_completions_recurrence_anchor_valid check (
    recurrence_anchor is null or recurrence_anchor in ('completed_date', 'fixed_calendar')
  )
);

create unique index maintenance_completions_task_once_idx
  on maintenance_completions (task_id);

create index maintenance_completions_house_completed_idx
  on maintenance_completions (house_id, completed_date desc, created_at desc);

create table house_documents (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  object_key text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  checksum_sha256 text,
  upload_status text not null default 'uploaded',
  storage_provider text not null default 's3',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_documents_id_shape check (
    id ~ '^doc_[a-z0-9][a-z0-9_-]{7,63}$'
  ),
  constraint house_documents_mime_valid check (
    mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf')
  ),
  constraint house_documents_size_valid check (
    size_bytes > 0 and size_bytes <= 15728640
  ),
  constraint house_documents_status_valid check (
    upload_status in ('uploaded', 'archived')
  )
);

create index house_documents_house_created_idx
  on house_documents (house_id, created_at desc)
  where archived_at is null;

alter table maintenance_tasks
  add constraint maintenance_tasks_recommendation_fk
  foreign key (recommendation_id)
  references maintenance_recommendations(id)
  on delete set null;
