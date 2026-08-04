alter table house_claims
  add column if not exists owner_action_token_hash text,
  add column if not exists owner_action_expires_at timestamptz,
  add column if not exists resolved_by_owner_user_id text references users(id) on delete set null;

create unique index if not exists house_claims_owner_action_token_uidx
  on house_claims (owner_action_token_hash)
  where owner_action_token_hash is not null;
