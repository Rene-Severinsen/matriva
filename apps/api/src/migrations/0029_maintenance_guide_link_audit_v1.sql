-- Keep an append-only audit trail for guide/recommendation link changes.
create table if not exists maintenance_guide_link_audit_log (
  id bigserial primary key,
  catalog_item_id text not null references maintenance_catalog_items(id) on delete restrict,
  catalog_key text not null,
  catalog_version text not null,
  guide_template_id text,
  guide_version_id text,
  action text not null,
  actor_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint maintenance_guide_link_audit_action_valid check (action in ('linked', 'unlinked')),
  constraint maintenance_guide_link_audit_guide_pair_shape check ((guide_template_id is null) = (guide_version_id is null))
);

create index if not exists maintenance_guide_link_audit_catalog_idx
  on maintenance_guide_link_audit_log (catalog_item_id, created_at desc);

create index if not exists maintenance_guide_link_audit_actor_idx
  on maintenance_guide_link_audit_log (actor_user_id, created_at desc);

-- Preserve the timestamp of existing links without inventing an actor.
insert into maintenance_guide_link_audit_log
  (catalog_item_id, catalog_key, catalog_version, guide_template_id, guide_version_id, action, created_at)
select mci.id, mci.catalog_key, mci.catalog_version, mci.guide_template_id, mci.guide_version_id, 'linked', mci.updated_at
from maintenance_catalog_items mci
where mci.guide_template_id is not null
  and mci.guide_version_id is not null
  and not exists (
    select 1
    from maintenance_guide_link_audit_log l
    where l.catalog_item_id = mci.id
  );
