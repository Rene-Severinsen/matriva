create table notification_preferences (
  user_id text not null references users(id) on delete cascade,
  category text not null,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category),
  constraint notification_preferences_category_valid check (
    category in ('maintenance', 'documents', 'house_access', 'system')
  )
);

create table notification_reminder_settings (
  user_id text not null references users(id) on delete cascade,
  category text not null,
  offset_days integer not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category, offset_days),
  constraint notification_reminder_settings_category_valid check (category = 'maintenance'),
  constraint notification_reminder_settings_offset_valid check (offset_days between 0 and 365)
);

create table notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  house_id text references houses(id) on delete cascade,
  notification_type text not null,
  category text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  deep_link text,
  priority text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  deduplication_key text not null,
  in_app_visible boolean not null default true,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_id_shape check (id ~ '^notif_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint notifications_category_valid check (
    category in ('maintenance', 'documents', 'house_access', 'system')
  ),
  constraint notifications_priority_valid check (priority in ('low', 'normal', 'high')),
  constraint notifications_deduplication_key_not_blank check (length(trim(deduplication_key)) > 0)
);
create unique index notifications_deduplication_key_uidx on notifications (deduplication_key);
create index notifications_user_feed_idx on notifications (user_id, created_at desc, id desc)
  where in_app_visible;
create index notifications_user_unread_idx on notifications (user_id, created_at desc)
  where in_app_visible and read_at is null;

create table notification_devices (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  device_id text not null,
  platform text not null,
  push_token text not null,
  enabled boolean not null default true,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_devices_id_shape check (id ~ '^ndev_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint notification_devices_platform_valid check (platform in ('ios', 'android')),
  constraint notification_devices_device_not_blank check (length(trim(device_id)) > 0),
  constraint notification_devices_token_not_blank check (length(trim(push_token)) > 0),
  unique (user_id, device_id)
);
create unique index notification_devices_push_token_uidx on notification_devices (push_token);
create index notification_devices_user_enabled_idx on notification_devices (user_id) where enabled;

create table notification_push_outbox (
  id text primary key,
  notification_id text not null references notifications(id) on delete cascade,
  device_id text not null references notification_devices(id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_ticket_id text,
  receipt_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_push_outbox_id_shape check (id ~ '^nout_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint notification_push_outbox_status_valid check (
    status in ('pending', 'sending', 'sent', 'failed', 'invalid_token')
  ),
  constraint notification_push_outbox_attempts_valid check (attempts >= 0),
  unique (notification_id, device_id)
);
create index notification_push_outbox_pending_idx
  on notification_push_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

insert into notification_preferences (user_id, category)
select u.id, category
from users u
cross join (values ('maintenance'), ('documents'), ('house_access'), ('system')) categories(category)
on conflict do nothing;

insert into notification_reminder_settings (user_id, category, offset_days)
select u.id, 'maintenance', offset_days
from users u
cross join (values (7), (0)) offsets(offset_days)
on conflict do nothing;
