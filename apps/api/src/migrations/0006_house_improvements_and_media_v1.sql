create table house_improvements (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  improvement_date date,
  improvement_year integer,
  cost_amount_minor integer,
  cost_currency text,
  document_reference text,
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_improvements_id_shape check (id ~ '^impr_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_improvements_category_valid check (
    category is null or category in (
      'windows_doors',
      'roof',
      'heating_energy',
      'kitchen',
      'bathroom',
      'installations',
      'extension',
      'outdoor',
      'other'
    )
  ),
  constraint house_improvements_status_valid check (
    status in ('planned', 'completed', 'documented')
  ),
  constraint house_improvements_date_or_year check (
    improvement_date is not null or improvement_year is not null
  ),
  constraint house_improvements_year_valid check (
    improvement_year is null or improvement_year between 1700 and 2200
  ),
  constraint house_improvements_cost_valid check (
    (cost_amount_minor is null and cost_currency is null)
    or (cost_amount_minor is not null and cost_amount_minor >= 0 and cost_currency ~ '^[A-Z]{3}$')
  )
);

create index house_improvements_house_date_idx
  on house_improvements (
    house_id,
    coalesce(improvement_date, make_date(improvement_year, 1, 1)) desc,
    created_at desc
  );

create index house_improvements_user_created_at_idx
  on house_improvements (user_id, created_at desc);

create table house_media (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  media_type text not null,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  storage_key text not null unique,
  is_current_house_photo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_media_id_shape check (id ~ '^media_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_media_type_valid check (media_type in ('house_photo')),
  constraint house_media_size_valid check (size_bytes > 0),
  constraint house_media_dimensions_valid check (
    (width is null or width > 0) and (height is null or height > 0)
  )
);

create unique index house_media_current_house_photo_idx
  on house_media (house_id)
  where is_current_house_photo;

create index house_media_house_created_at_idx
  on house_media (house_id, created_at desc);
