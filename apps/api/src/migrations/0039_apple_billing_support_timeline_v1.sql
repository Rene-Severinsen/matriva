-- Preserve signed Apple evidence separately from the normalized support timeline.
alter table billing_events
  add column if not exists notification_subtype text,
  add column if not exists apple_signed_at timestamptz,
  add column if not exists original_transaction_id text,
  add column if not exists product_id text,
  add column if not exists raw_signed_payload text,
  add column if not exists raw_signed_transaction_info text,
  add column if not exists raw_signed_renewal_info text,
  add column if not exists decoded_transaction jsonb,
  add column if not exists decoded_renewal jsonb,
  add column if not exists verification jsonb not null default '{}'::jsonb,
  add column if not exists processing_steps jsonb not null default '[]'::jsonb,
  add column if not exists processing_status text not null default 'legacy_unknown',
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempt_count integer not null default 0,
  add column if not exists correlation_id text;

create index if not exists billing_events_original_transaction_idx
  on billing_events (provider, environment, original_transaction_id, id desc);
create index if not exists billing_events_user_timeline_idx
  on billing_events (user_id, id desc);

alter table billing_subscriptions
  add column if not exists auto_renew_product_id text,
  add column if not exists renewal_date timestamptz,
  add column if not exists renewal_price bigint,
  add column if not exists renewal_currency text,
  add column if not exists grace_period_expires_at timestamptz,
  add column if not exists is_in_billing_retry_period boolean,
  add column if not exists expiration_intent text,
  add column if not exists price_increase_status text,
  add column if not exists last_apple_notification_uuid text,
  add column if not exists last_apple_signed_at timestamptz;

create table if not exists billing_payload_access_audit (
  id bigserial primary key,
  actor_user_id text not null references users(id) on delete cascade,
  target_user_id text not null references users(id) on delete cascade,
  billing_event_id bigint not null references billing_events(id) on delete cascade,
  action text not null check (action in ('view', 'copy_raw', 'copy_decoded', 'download')),
  created_at timestamptz not null default now()
);
create index if not exists billing_payload_access_audit_event_idx
  on billing_payload_access_audit (billing_event_id, created_at desc);
