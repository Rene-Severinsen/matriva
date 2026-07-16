create table if not exists users (
  id text primary key,
  email text not null unique,
  email_verified_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint users_id_shape check (id ~ '^usr_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_status_valid check (status in ('active', 'disabled'))
);

create table if not exists user_profiles (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'da-DK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_id_shape check (id ~ '^profile_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint user_profiles_display_name_not_blank check (
    display_name is null or length(btrim(display_name)) > 0
  ),
  constraint user_profiles_locale_valid check (preferred_locale in ('da-DK'))
);

create table if not exists magic_link_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  requested_ip_hash text,
  user_agent_hint text,
  constraint magic_link_tokens_id_shape check (id ~ '^mlt_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint magic_link_tokens_consumed_before_expiry check (
    consumed_at is null or consumed_at <= expires_at
  )
);

create index if not exists magic_link_tokens_user_created_at_idx
  on magic_link_tokens (user_id, created_at desc);

create index if not exists magic_link_tokens_expires_at_idx
  on magic_link_tokens (expires_at);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  access_token_hash text not null unique,
  access_token_expires_at timestamptz not null,
  refresh_token_hash text not null unique,
  refresh_token_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint auth_sessions_id_shape check (id ~ '^sess_[a-z0-9][a-z0-9_-]{7,63}$')
);

create index if not exists auth_sessions_user_created_at_idx
  on auth_sessions (user_id, created_at desc);

create index if not exists auth_sessions_access_lookup_idx
  on auth_sessions (access_token_hash)
  where revoked_at is null;

create index if not exists auth_sessions_refresh_lookup_idx
  on auth_sessions (refresh_token_hash)
  where revoked_at is null;

create table if not exists auth_email_rate_limits (
  normalized_email text primary key,
  last_requested_at timestamptz not null,
  request_count integer not null default 1,
  window_started_at timestamptz not null default now(),
  constraint auth_email_rate_limits_email_lowercase check (normalized_email = lower(normalized_email))
);

alter table houses
  add column if not exists user_id text references users(id) on delete cascade;

alter table houses
  alter column dev_user_id drop not null;

insert into users (id, email, email_verified_at, status, created_at, updated_at)
select id, email, now(), 'active', created_at, updated_at
from dev_users
on conflict (email) do update
set updated_at = greatest(users.updated_at, excluded.updated_at);

insert into user_profiles (id, user_id, display_name, preferred_locale, created_at, updated_at)
select
  'profile_' || substring(md5(dev_users.id) from 1 for 24),
  users.id,
  case when dev_users.email = 'rene@joinit.dk' then 'Rene' else null end,
  'da-DK',
  dev_users.created_at,
  dev_users.updated_at
from dev_users
join users on users.email = dev_users.email
on conflict (user_id) do nothing;

update houses
set user_id = users.id
from dev_users
join users on users.email = dev_users.email
where houses.dev_user_id = dev_users.id
  and houses.user_id is null;

alter table houses
  alter column user_id set not null;

create index if not exists houses_user_id_created_at_idx
  on houses (user_id, created_at desc);
