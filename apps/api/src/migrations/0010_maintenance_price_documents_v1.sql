alter table maintenance_tasks
  add column if not exists price_amount_minor bigint,
  add column if not exists price_currency text not null default 'DKK';

alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_price_valid;

alter table maintenance_tasks
  add constraint maintenance_tasks_price_valid check (
    price_amount_minor is null
    or (price_amount_minor >= 0 and price_amount_minor <= 999999999999)
  );

alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_price_currency_valid;

alter table maintenance_tasks
  add constraint maintenance_tasks_price_currency_valid check (
    price_currency = 'DKK'
  );

alter table maintenance_completions
  add column if not exists price_amount_minor bigint,
  add column if not exists price_currency text not null default 'DKK';

update maintenance_completions
set price_amount_minor = cost_amount_minor
where price_amount_minor is null
  and cost_amount_minor is not null;

alter table maintenance_completions
  drop constraint if exists maintenance_completions_cost_valid;

alter table maintenance_completions
  drop constraint if exists maintenance_completions_price_valid;

alter table maintenance_completions
  add constraint maintenance_completions_price_valid check (
    price_amount_minor is null
    or (price_amount_minor >= 0 and price_amount_minor <= 999999999999)
  );

alter table maintenance_completions
  drop constraint if exists maintenance_completions_price_currency_valid;

alter table maintenance_completions
  add constraint maintenance_completions_price_currency_valid check (
    price_currency = 'DKK'
  );

alter table maintenance_completions
  drop column if exists vendor,
  drop column if exists cost_amount_minor,
  drop column if exists cost_currency,
  drop column if exists warranty_expires_at,
  drop column if exists improvement_id;

create table if not exists house_documents (
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

create index if not exists house_documents_house_created_idx
  on house_documents (house_id, created_at desc)
  where archived_at is null;

drop table if exists maintenance_attachments;
