create table if not exists maintenance_catalog_items (
  id text primary key,
  catalog_key text not null,
  catalog_version text not null,
  title text not null,
  short_description text not null,
  component_key text not null,
  season text not null,
  recommended_period jsonb not null,
  default_recurrence_interval text not null,
  priority text not null,
  eligibility_rules jsonb not null,
  disclaimer_class text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_catalog_items_id_shape check (
    id ~ '^mcat_[a-z0-9][a-z0-9_-]{7,63}$'
  ),
  constraint maintenance_catalog_items_key_shape check (
    catalog_key ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint maintenance_catalog_items_component_valid check (
    component_key in (
      'none',
      'roof',
      'facade',
      'windows',
      'doors',
      'foundation',
      'drainage',
      'heating',
      'plumbing',
      'electricity',
      'interior',
      'garden',
      'other'
    )
  ),
  constraint maintenance_catalog_items_season_valid check (
    season in ('spring', 'summer', 'autumn', 'winter', 'all_year')
  ),
  constraint maintenance_catalog_items_recurrence_valid check (
    default_recurrence_interval in (
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
  constraint maintenance_catalog_items_priority_valid check (
    priority in ('low', 'normal', 'high')
  ),
  constraint maintenance_catalog_items_disclaimer_valid check (
    disclaimer_class in ('general', 'safety', 'professional_review')
  )
);

create unique index if not exists maintenance_catalog_items_key_version_idx
  on maintenance_catalog_items (catalog_key, catalog_version);

create index if not exists maintenance_catalog_items_active_idx
  on maintenance_catalog_items (is_active, catalog_key);

create table if not exists maintenance_recommendation_hides (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  catalog_key text not null,
  hidden_at timestamptz not null default now(),
  unhidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_recommendation_hides_id_shape check (
    id ~ '^mhide_[a-z0-9][a-z0-9_-]{7,63}$'
  )
);

create unique index if not exists maintenance_recommendation_hides_house_key_idx
  on maintenance_recommendation_hides (house_id, catalog_key)
  where unhidden_at is null;

alter table maintenance_recommendations
  add column if not exists catalog_item_id text references maintenance_catalog_items(id) on delete restrict,
  add column if not exists period_key text,
  add column if not exists suggested_due_date date,
  add column if not exists eligibility_snapshot jsonb,
  add column if not exists catalog_key text,
  add column if not exists catalog_version text,
  add column if not exists recommended_period jsonb,
  add column if not exists priority text,
  add column if not exists disclaimer_class text,
  add column if not exists why text;

update maintenance_recommendations
set
  catalog_key = coalesce(catalog_key, recommendation_key),
  catalog_version = coalesce(catalog_version, version_key),
  period_key = coalesce(period_key, version_key),
  suggested_due_date = coalesce(suggested_due_date, due_date),
  eligibility_snapshot = coalesce(
    eligibility_snapshot,
    jsonb_build_object('type', 'legacy_recommendation')
  ),
  recommended_period = coalesce(
    recommended_period,
    case
      when season is not null then jsonb_build_object('type', 'season', 'season', season)
      else jsonb_build_object('type', 'all_year')
    end
  ),
  priority = coalesce(priority, 'normal'),
  disclaimer_class = coalesce(disclaimer_class, 'general'),
  why = coalesce(why, description)
where source_type = 'matriva_catalog';

alter table maintenance_recommendations
  drop constraint if exists maintenance_recommendations_priority_valid;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_priority_valid check (
    priority is null or priority in ('low', 'normal', 'high')
  );

alter table maintenance_recommendations
  drop constraint if exists maintenance_recommendations_disclaimer_valid;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_disclaimer_valid check (
    disclaimer_class is null or disclaimer_class in ('general', 'safety', 'professional_review')
  );

create unique index if not exists maintenance_recommendations_house_catalog_period_idx
  on maintenance_recommendations (house_id, catalog_item_id, period_key)
  where catalog_item_id is not null and period_key is not null;

create index if not exists maintenance_recommendations_house_catalog_status_idx
  on maintenance_recommendations (house_id, catalog_key, status);

alter table maintenance_tasks
  add column if not exists origin_catalog_key text,
  add column if not exists origin_catalog_version text,
  add column if not exists origin_recommendation_instance_id text references maintenance_recommendations(id) on delete set null,
  add column if not exists origin_snapshot jsonb;

update maintenance_tasks mt
set
  origin_catalog_key = coalesce(origin_catalog_key, mt.recommendation->>'recommendationKey'),
  origin_catalog_version = coalesce(origin_catalog_version, mt.recommendation->>'recommendationKey'),
  origin_recommendation_instance_id = coalesce(origin_recommendation_instance_id, mt.recommendation_id)
where mt.source = 'recommendation_accepted';

create index if not exists maintenance_tasks_house_origin_active_idx
  on maintenance_tasks (house_id, origin_catalog_key, due_date)
  where origin_catalog_key is not null
    and deleted_at is null
    and archived_at is null
    and status <> 'done';
