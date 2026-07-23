create table if not exists user_roles (
  user_id text not null references users(id) on delete cascade,
  role text not null,
  provisioned_by text not null,
  created_at timestamptz not null default now(),
  constraint user_roles_role_valid check (role in ('SUPER_ADMIN')),
  constraint user_roles_provisioned_by_not_blank check (length(btrim(provisioned_by)) > 0),
  primary key (user_id, role)
);

create index if not exists user_roles_role_created_at_idx
  on user_roles (role, created_at desc);

insert into user_roles (user_id, role, provisioned_by)
select id, 'SUPER_ADMIN', 'permanent_super_admin_email'
from users
where email = 'rene@joinit.dk'
on conflict (user_id, role) do nothing;
