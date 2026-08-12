-- Guide publication is a lifecycle change, not deletion. Keep an append-only
-- record for every explicit draft/published transition.
create table if not exists guide_status_audit_log (
  id bigserial primary key,
  guide_template_id text not null references guide_templates(id) on delete restrict,
  guide_version_id text not null references guide_versions(id) on delete restrict,
  from_status text not null,
  to_status text not null,
  action text not null,
  actor_user_id text references users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint guide_status_audit_status_valid check (from_status in ('draft', 'published', 'archived') and to_status in ('draft', 'published', 'archived')),
  constraint guide_status_audit_action_valid check (action in ('guide_published', 'guide_unpublished', 'guide_status_changed')),
  constraint guide_status_audit_metadata_shape check (jsonb_typeof(metadata) = 'object')
);

create index if not exists guide_status_audit_guide_idx
  on guide_status_audit_log (guide_template_id, created_at desc);

create index if not exists guide_status_audit_actor_idx
  on guide_status_audit_log (actor_user_id, created_at desc);

-- Guide 01's visual approval is already recorded in the versioned asset
-- provenance/approval work. This only carries that approval into the existing
-- guide lifecycle field; it deliberately does not publish the guide.
update guide_versions
set validation_status = 'approved', updated_at = now()
where id = 'gver_rens_tagrender_v1'
  and publication_status = 'draft';
