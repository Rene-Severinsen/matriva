-- Restore a separately auditable, admin-granted free PRO entitlement.
alter table user_entitlements
  add column if not exists updated_by_user_id text references users(id) on delete set null,
  add column if not exists granted_by_user_id text references users(id) on delete set null,
  add column if not exists granted_at timestamptz,
  add column if not exists reason text;

alter table user_entitlements
  drop constraint if exists user_entitlements_source_valid;
alter table user_entitlements
  add constraint user_entitlements_source_valid
  check (source in ('default', 'complimentary', 'subscription', 'billing'));

create index if not exists user_entitlements_complimentary_idx
  on user_entitlements (source, expires_at)
  where source = 'complimentary';
