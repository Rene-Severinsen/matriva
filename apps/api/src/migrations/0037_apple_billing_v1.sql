-- Retire admin-granted PRO and normalize the provider-neutral billing foundation.
delete from user_entitlements where source = 'complimentary';

alter table user_entitlements
  drop constraint if exists user_entitlements_source_valid;
alter table user_entitlements
  drop column if exists granted_by_user_id,
  drop column if exists granted_at,
  drop column if exists reason;
alter table user_entitlements
  add constraint user_entitlements_source_valid
  check (source in ('default', 'subscription', 'billing'));
drop index if exists user_entitlements_complimentary_idx;

create table if not exists billing_subscriptions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  provider text not null,
  provider_subscription_id text,
  product_id text not null,
  plan text not null default 'pro',
  status text not null default 'active',
  environment text not null,
  original_transaction_id text,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  auto_renew boolean,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_provider_valid check (provider in ('apple', 'google')),
  constraint billing_subscriptions_plan_valid check (plan in ('free', 'pro')),
  constraint billing_subscriptions_status_valid check (status in ('trial', 'active', 'grace_period', 'billing_issue', 'expired', 'cancelled', 'refunded_revoked')),
  constraint billing_subscriptions_environment_valid check (environment in ('sandbox', 'production'))
);
alter table billing_subscriptions
  add column if not exists provider_subscription_id text,
  add column if not exists plan text not null default 'pro',
  add column if not exists status text not null default 'active',
  add column if not exists current_period_starts_at timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists auto_renew boolean,
  add column if not exists last_verified_at timestamptz;
create unique index if not exists billing_subscriptions_provider_subscription_unique
  on billing_subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists billing_subscriptions_user_idx
  on billing_subscriptions (user_id, updated_at desc);

create table if not exists billing_events (
  id bigserial primary key,
  provider text not null,
  environment text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_subscription_id text,
  user_id text references users(id) on delete set null,
  occurred_at timestamptz,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  constraint billing_events_provider_valid check (provider in ('apple', 'google')),
  constraint billing_events_environment_valid check (environment in ('sandbox', 'production'))
);
alter table billing_events
  add column if not exists environment text not null default 'production',
  add column if not exists provider_subscription_id text,
  add column if not exists user_id text references users(id) on delete set null,
  add column if not exists occurred_at timestamptz,
  add column if not exists created_at timestamptz not null default now();
create unique index if not exists billing_events_provider_event_unique
  on billing_events (provider, environment, provider_event_id);
create index if not exists billing_events_subscription_idx
  on billing_events (provider, environment, provider_subscription_id, occurred_at desc);
