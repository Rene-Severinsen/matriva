-- Earlier billing foundations left provider_status as a required legacy field.
-- New subscriptions use status; keep old data readable without requiring writes to the retired field.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'billing_subscriptions'
      and column_name = 'provider_status'
  ) then
    alter table billing_subscriptions alter column provider_status drop not null;
  end if;
end $$;
