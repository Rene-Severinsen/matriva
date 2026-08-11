alter table user_entitlements
  add column if not exists granted_by_user_id text references users(id) on delete set null,
  add column if not exists granted_at timestamptz,
  add column if not exists reason text;

alter table user_entitlements
  drop constraint if exists user_entitlements_source_valid;

alter table user_entitlements
  add constraint user_entitlements_source_valid
  check (source in ('default', 'admin', 'subscription', 'billing', 'complimentary'));

update user_entitlements
set
  source = 'subscription'
where plan = 'pro'
  and source = 'admin';

create index if not exists user_entitlements_complimentary_idx
  on user_entitlements (source, expires_at)
  where plan = 'pro' and source = 'complimentary';
