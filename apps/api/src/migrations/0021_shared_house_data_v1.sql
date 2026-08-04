-- House data is shared by active members. user_id remains on records as creator/actor audit data.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select tc.table_name, tc.constraint_name
    from information_schema.table_constraints tc
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = current_schema()
      and tc.table_name = 'house_improvement_documents'
  loop
    execute format('alter table %I drop constraint %I', constraint_row.table_name, constraint_row.constraint_name);
  end loop;
end
$$;

alter table house_improvement_documents
  add constraint house_improvement_documents_improvement_fk foreign key (improvement_id) references house_improvements(id) on delete cascade,
  add constraint house_improvement_documents_document_fk foreign key (document_id) references house_documents(id) on delete cascade,
  add constraint house_improvement_documents_house_fk foreign key (house_id) references houses(id) on delete cascade,
  add constraint house_improvement_documents_user_fk foreign key (user_id) references users(id) on delete cascade;

create index if not exists maintenance_completions_house_completed_idx
  on maintenance_completions (house_id, completed_date desc, created_at desc)
  where reversed_at is null;
create index if not exists maintenance_recommendations_house_status_idx
  on maintenance_recommendations (house_id, status, created_at desc);
create index if not exists house_documents_house_active_idx
  on house_documents (house_id, created_at desc)
  where archived_at is null and upload_status = 'uploaded';
create index if not exists house_improvements_house_active_v1_idx
  on house_improvements (house_id, completed_date desc, created_at desc)
  where archived_at is null;
create index if not exists house_media_current_house_idx
  on house_media (house_id, created_at desc)
  where is_current_house_photo;
create index if not exists house_improvement_documents_house_idx
  on house_improvement_documents (house_id, created_at desc);

with ranked as (
  select id, row_number() over (partition by house_id, email order by created_at, id) as duplicate_rank
  from house_invitations
  where status = 'pending' and expires_at > now()
)
update house_invitations i
set status = 'revoked', updated_at = now()
from ranked r
where i.id = r.id and r.duplicate_rank > 1;

create unique index if not exists house_invitations_pending_email_uidx
  on house_invitations (house_id, email)
  where status = 'pending';
