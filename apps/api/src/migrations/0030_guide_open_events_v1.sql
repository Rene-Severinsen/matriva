-- Store explicit guide opens from the app for lightweight usage analytics.
-- No user identity is stored; only the guide/version and timestamp are needed.
create table if not exists guide_open_events (
  id bigserial primary key,
  guide_template_id text not null references guide_templates(id) on delete restrict,
  guide_version_id text not null references guide_versions(id) on delete restrict,
  opened_at timestamptz not null default now()
);

create index if not exists guide_open_events_version_opened_idx
  on guide_open_events (guide_version_id, opened_at desc);

create index if not exists guide_open_events_opened_at_idx
  on guide_open_events (opened_at desc);
