-- V1 structured house knowledge. Facts and components belong to a house,
-- not to a recommendation instance or maintenance task.
create table if not exists house_facts (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  fact_key text not null,
  value jsonb not null,
  source text not null,
  confidence text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_facts_id_shape check (id ~ '^hfact_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_facts_key_shape check (fact_key ~ '^[a-z][a-z0-9_.-]{1,119}$'),
  constraint house_facts_source_valid check (source in ('bbr', 'user', 'manual', 'ai')),
  constraint house_facts_confidence_valid check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint house_facts_value_shape check (jsonb_typeof(value) in ('object', 'array', 'string', 'number', 'boolean'))
);

create unique index if not exists house_facts_house_key_uidx
  on house_facts (house_id, fact_key);
create index if not exists house_facts_house_updated_idx
  on house_facts (house_id, updated_at desc);

create table if not exists house_components (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  component_key text not null,
  status text not null default 'unknown',
  attributes jsonb not null default '{}'::jsonb,
  source text not null,
  confidence text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_components_id_shape check (id ~ '^hcomp_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_components_key_shape check (component_key ~ '^[a-z][a-z0-9_.-]{1,119}$'),
  constraint house_components_status_valid check (status in ('present', 'absent', 'unknown')),
  constraint house_components_source_valid check (source in ('bbr', 'user', 'manual', 'ai')),
  constraint house_components_confidence_valid check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint house_components_attributes_shape check (jsonb_typeof(attributes) = 'object')
);

create unique index if not exists house_components_house_key_uidx
  on house_components (house_id, component_key);
create index if not exists house_components_house_updated_idx
  on house_components (house_id, updated_at desc);

-- Keep an explicit applicability version on the catalog rows while retaining
-- the existing eligibility_rules JSON for old admin/API consumers.
alter table maintenance_catalog_items
  add column if not exists applicability_version text not null default 'v1';

alter table maintenance_catalog_items
  add constraint maintenance_catalog_items_applicability_version_valid
  check (applicability_version = 'v1');
