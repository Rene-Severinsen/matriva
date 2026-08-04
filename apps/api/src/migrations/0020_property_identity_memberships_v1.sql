alter table houses
  add column if not exists bfe_number text,
  add column if not exists dawa_access_address_id text;

update houses
set dawa_access_address_id = source_access_address_id
where dawa_access_address_id is null;

update houses h
set bfe_number = s.bfe_number
from (
  select distinct on (house_id) house_id, bfe_number
  from house_public_data_snapshots
  where house_id is not null and bfe_number is not null
  order by house_id, is_current desc, created_at desc
) s
where h.id = s.house_id and h.bfe_number is null;

alter table houses drop constraint if exists houses_status_valid;
alter table houses add constraint houses_status_valid check (status in ('saved', 'archived'));

-- Preserve legacy rows, but never leave an unidentifiable row active after this migration.
update houses set status = 'archived' where bfe_number is null and status = 'saved';

-- If old test data contains duplicates, retain the oldest physical property row and
-- archive the later copies. No data is deleted and the original ids remain traceable.
with ranked as (
  select id, row_number() over (partition by bfe_number order by created_at, id) as duplicate_rank
  from houses
  where bfe_number is not null and status = 'saved'
)
update houses h
set status = 'archived', updated_at = now()
from ranked r
where h.id = r.id and r.duplicate_rank > 1;

create unique index if not exists houses_active_bfe_number_uidx
  on houses (bfe_number)
  where bfe_number is not null and status = 'saved';

create table if not exists house_memberships (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  invited_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_memberships_id_shape check (id ~ '^hm_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_memberships_role_valid check (role in ('owner', 'member')),
  constraint house_memberships_status_valid check (status in ('active', 'revoked')),
  constraint house_memberships_validity check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists house_memberships_active_user_uidx
  on house_memberships (house_id, user_id)
  where status = 'active';
create index if not exists house_memberships_user_idx on house_memberships (user_id, status);

insert into house_memberships (id, house_id, user_id, role, status, valid_from, created_at, updated_at)
select
  'hm_' || substring(md5(h.id || ':' || h.user_id) from 1 for 24),
  h.id,
  h.user_id,
  'owner',
  'active',
  h.created_at,
  h.created_at,
  h.updated_at
from houses h
where h.user_id is not null and h.status = 'saved'
on conflict (house_id, user_id) where status = 'active' do nothing;

create table if not exists house_claims (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  claim_type text not null,
  status text not null default 'pending',
  verification_method text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_admin_user_id text references users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_claims_id_shape check (id ~ '^claim_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_claims_type_valid check (claim_type in ('owner', 'resident', 'household_member')),
  constraint house_claims_status_valid check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);
create unique index if not exists house_claims_pending_user_uidx
  on house_claims (house_id, user_id) where status = 'pending';

create table if not exists house_invitations (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  status text not null default 'pending',
  token_hash text not null unique,
  expires_at timestamptz not null,
  invited_by_user_id text not null references users(id) on delete restrict,
  accepted_by_user_id text references users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_invitations_role_valid check (role in ('owner', 'member')),
  constraint house_invitations_status_valid check (status in ('pending', 'accepted', 'expired', 'revoked')),
  constraint house_invitations_email_lowercase check (email = lower(email))
);
create index if not exists house_invitations_house_idx on house_invitations (house_id, status);
