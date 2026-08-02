drop table if exists house_improvement_documents;
drop table if exists house_improvement_expenses;
drop table if exists house_improvement_items;
drop table if exists house_improvements;

create table house_improvements (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  completed_date date not null,
  total_amount_minor bigint,
  currency text not null default 'DKK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, house_id, user_id),
  constraint house_improvements_id_shape check (id ~ '^impr_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_improvements_category_valid check (category in ('windows_doors','roof','heating_energy','kitchen','bathroom','installations','extension','outdoor','other')),
  constraint house_improvements_amount_valid check (total_amount_minor is null or total_amount_minor between 0 and 999999999999),
  constraint house_improvements_currency_valid check (currency = 'DKK')
);
create index house_improvements_house_active_idx on house_improvements (house_id, completed_date desc, created_at desc) where archived_at is null;

alter table house_documents drop constraint if exists house_documents_identity_unique;
alter table house_documents add constraint house_documents_identity_unique unique (id, house_id, user_id);

create table house_improvement_documents (
  improvement_id text not null,
  house_id text not null,
  user_id text not null,
  document_id text not null,
  created_at timestamptz not null default now(),
  foreign key (improvement_id, house_id, user_id) references house_improvements(id, house_id, user_id) on delete cascade,
  foreign key (document_id, house_id, user_id) references house_documents(id, house_id, user_id) on delete cascade,
  primary key (improvement_id, document_id)
);
create index house_improvement_documents_improvement_idx on house_improvement_documents (improvement_id, created_at desc);
