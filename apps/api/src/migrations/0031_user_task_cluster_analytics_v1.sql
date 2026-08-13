-- Analytical classification for user-authored maintenance tasks.
-- The source task row is intentionally never modified by this model.
create table if not exists maintenance_task_clusters (
  id text primary key,
  cluster_key text not null unique,
  label text not null,
  status text not null default 'candidate',
  coverage_catalog_key text,
  coverage_catalog_version text,
  classifier_version text not null,
  created_by_admin_user_id text references users(id) on delete set null,
  updated_by_admin_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_task_clusters_id_shape check (id ~ '^tcluster_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint maintenance_task_clusters_status_valid check (status in ('covered', 'candidate', 'under_review', 'ignored', 'adopted')),
  constraint maintenance_task_clusters_coverage_pair_valid check ((coverage_catalog_key is null) = (coverage_catalog_version is null))
);

create index if not exists maintenance_task_clusters_status_idx
  on maintenance_task_clusters (status, updated_at desc);

create table if not exists maintenance_task_cluster_memberships (
  task_id text primary key references maintenance_tasks(id) on delete cascade,
  cluster_id text references maintenance_task_clusters(id) on delete set null,
  normalized_text text not null,
  classification_method text not null,
  confidence numeric(5,4) not null,
  classifier_version text not null,
  classified_at timestamptz not null default now(),
  updated_by_admin_user_id text references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint maintenance_task_cluster_memberships_method_valid check (classification_method in ('normalization', 'known_match', 'semantic', 'manual')),
  constraint maintenance_task_cluster_memberships_confidence_valid check (confidence >= 0 and confidence <= 1)
);

create index if not exists maintenance_task_cluster_memberships_cluster_idx
  on maintenance_task_cluster_memberships (cluster_id, updated_at desc);

create table if not exists maintenance_task_cluster_audit_log (
  id bigserial primary key,
  action text not null,
  task_id text references maintenance_tasks(id) on delete set null,
  cluster_id text references maintenance_task_clusters(id) on delete set null,
  from_cluster_id text references maintenance_task_clusters(id) on delete set null,
  to_cluster_id text references maintenance_task_clusters(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  actor_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint maintenance_task_cluster_audit_action_valid check (action in ('classified', 'corrected', 'merged', 'split', 'status_changed')),
  constraint maintenance_task_cluster_audit_details_shape check (jsonb_typeof(details) = 'object')
);

create index if not exists maintenance_task_cluster_audit_cluster_idx
  on maintenance_task_cluster_audit_log (cluster_id, created_at desc);

