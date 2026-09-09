alter table notification_devices
  add column if not exists permission_status text not null default 'unknown';

alter table notification_devices
  drop constraint if exists notification_devices_permission_status_valid;
alter table notification_devices
  add constraint notification_devices_permission_status_valid
  check (permission_status in ('granted', 'denied', 'unknown'));

create table if not exists notification_admin_test_audit (
  id text primary key,
  admin_user_id text not null references users(id) on delete restrict,
  target_user_id text not null references users(id) on delete restrict,
  target_device_id text references notification_devices(id) on delete set null,
  notification_id text not null references notifications(id) on delete cascade,
  result_status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_admin_test_audit_id_shape check (id ~ '^nat_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint notification_admin_test_audit_status_valid check (
    result_status in ('created', 'queued', 'sending', 'sent', 'receipt_ok', 'failed', 'invalid_token')
  )
);
create index if not exists notification_admin_test_audit_created_idx
  on notification_admin_test_audit (created_at desc);
create index if not exists notification_admin_test_audit_target_idx
  on notification_admin_test_audit (target_user_id, created_at desc);
