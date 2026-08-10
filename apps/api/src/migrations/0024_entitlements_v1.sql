create table if not exists entitlement_plan_configs (
  plan text primary key,
  features jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_user_id text references users(id) on delete set null,
  constraint entitlement_plan_configs_plan_valid check (plan in ('free', 'pro'))
);

create table if not exists user_entitlements (
  user_id text primary key references users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'free',
  source text not null default 'default',
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_user_id text references users(id) on delete set null,
  constraint user_entitlements_plan_valid check (plan in ('free', 'pro')),
  constraint user_entitlements_status_valid check (status in ('free', 'trial', 'active', 'grace_period', 'billing_issue', 'expired', 'cancelled', 'refunded_revoked')),
  constraint user_entitlements_source_valid check (source in ('default', 'admin', 'billing')),
  constraint user_entitlements_dates_valid check (expires_at is null or starts_at is null or expires_at >= starts_at)
);

create table if not exists entitlement_audit_log (
  id bigserial primary key,
  actor_user_id text references users(id) on delete set null,
  target_user_id text references users(id) on delete set null,
  action text not null,
  plan text,
  status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists entitlement_audit_log_target_idx
  on entitlement_audit_log (target_user_id, created_at desc);

insert into entitlement_plan_configs (plan, features)
values
  ('free', '{
    "houses.maxActive": {"kind":"limit","value":1},
    "documents.maxCount": {"kind":"limit","value":2},
    "documents.maxStorageMb": {"kind":"limit","value":10},
    "tasks.maxActive": {"kind":"limit","value":4},
    "maintenance.fullPlan.enabled": {"kind":"boolean","value":true},
    "seasonalRecommendations.enabled": {"kind":"boolean","value":true},
    "advisories.enabled": {"kind":"boolean","value":false},
    "localAdvisories.enabled": {"kind":"boolean","value":false},
    "legalUpdates.enabled": {"kind":"boolean","value":false},
    "documentExpiry.enabled": {"kind":"boolean","value":true},
    "sharing.enabled": {"kind":"boolean","value":false},
    "multiUser.enabled": {"kind":"boolean","value":false},
    "export.enabled": {"kind":"boolean","value":false},
    "history.extended.enabled": {"kind":"boolean","value":false},
    "advancedReminders.enabled": {"kind":"boolean","value":false}
  }'::jsonb),
  ('pro', '{
    "houses.maxActive": {"kind":"limit","value":null},
    "documents.maxCount": {"kind":"limit","value":null},
    "documents.maxStorageMb": {"kind":"limit","value":null},
    "tasks.maxActive": {"kind":"limit","value":null},
    "maintenance.fullPlan.enabled": {"kind":"boolean","value":true},
    "seasonalRecommendations.enabled": {"kind":"boolean","value":true},
    "advisories.enabled": {"kind":"boolean","value":true},
    "localAdvisories.enabled": {"kind":"boolean","value":true},
    "legalUpdates.enabled": {"kind":"boolean","value":true},
    "documentExpiry.enabled": {"kind":"boolean","value":true},
    "sharing.enabled": {"kind":"boolean","value":true},
    "multiUser.enabled": {"kind":"boolean","value":true},
    "export.enabled": {"kind":"boolean","value":true},
    "history.extended.enabled": {"kind":"boolean","value":true},
    "advancedReminders.enabled": {"kind":"boolean","value":true}
  }'::jsonb)
on conflict (plan) do nothing;
