create table house_public_data_snapshots (
  id text primary key,
  house_id text references houses(id) on delete cascade,
  house_draft_id text,
  provider text not null,
  register text not null,
  status text not null,
  fetched_at timestamptz not null default now(),
  effective_at timestamptz,
  mapping_version text not null,
  codebook_version text not null,
  raw_payload jsonb not null,
  raw_payload_hash text not null,
  normalized_payload jsonb not null,
  provider_error_code text,
  provider_error_message_sanitized text,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint house_public_data_snapshots_id_shape check (id ~ '^pubsnap_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_public_data_snapshots_target check (
    (house_id is not null and house_draft_id is null)
    or (house_id is null and house_draft_id is not null)
  ),
  constraint house_public_data_snapshots_provider_valid check (provider in ('datafordeler')),
  constraint house_public_data_snapshots_register_valid check (register in ('bbr')),
  constraint house_public_data_snapshots_status_valid check (
    status in (
      'not_started',
      'fetching',
      'success',
      'partial',
      'not_found',
      'ambiguous',
      'temporarily_unavailable',
      'failed'
    )
  )
);

create unique index house_public_data_current_house_idx
  on house_public_data_snapshots (house_id)
  where is_current and house_id is not null;

create unique index house_public_data_current_draft_idx
  on house_public_data_snapshots (house_draft_id)
  where is_current and house_draft_id is not null;

create index house_public_data_snapshots_house_created_at_idx
  on house_public_data_snapshots (house_id, created_at desc);

create table house_public_buildings (
  id text primary key,
  snapshot_id text not null references house_public_data_snapshots(id) on delete cascade,
  house_id text references houses(id) on delete cascade,
  bbr_building_id text not null,
  building_number integer,
  is_address_building boolean not null,
  included_in_product_view boolean not null,
  exclusion_reason text,
  lifecycle_code text not null,
  use_code text,
  construction_year integer,
  residential_area_m2 integer,
  total_building_area_m2 integer,
  raw_normalized jsonb not null,
  created_at timestamptz not null default now(),
  constraint house_public_buildings_id_shape check (id ~ '^pubbld_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_public_buildings_unique_source unique (snapshot_id, bbr_building_id)
);

create table house_public_units (
  id text primary key,
  snapshot_id text not null references house_public_data_snapshots(id) on delete cascade,
  building_id text not null references house_public_buildings(id) on delete cascade,
  bbr_unit_id text not null,
  bbr_building_id text not null,
  bbr_floor_id text,
  lifecycle_code text not null,
  use_code text,
  residential_area_m2 integer,
  total_area_m2 integer,
  room_count integer,
  raw_normalized jsonb not null,
  created_at timestamptz not null default now(),
  constraint house_public_units_id_shape check (id ~ '^pubunt_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_public_units_unique_source unique (snapshot_id, bbr_unit_id)
);

create table house_public_floors (
  id text primary key,
  snapshot_id text not null references house_public_data_snapshots(id) on delete cascade,
  building_id text not null references house_public_buildings(id) on delete cascade,
  bbr_floor_id text not null,
  bbr_building_id text not null,
  lifecycle_code text not null,
  designation text,
  total_floor_area_m2 integer,
  basement_area_m2 integer,
  legal_residential_basement_area_m2 integer,
  raw_normalized jsonb not null,
  created_at timestamptz not null default now(),
  constraint house_public_floors_id_shape check (id ~ '^pubflr_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_public_floors_unique_source unique (snapshot_id, bbr_floor_id)
);

create table house_public_parcels (
  id text primary key,
  snapshot_id text not null references house_public_data_snapshots(id) on delete cascade,
  cadastral_parcel_id text not null,
  cadastral_number text,
  owner_district_id text,
  municipality_id text,
  raw_normalized jsonb not null,
  created_at timestamptz not null default now(),
  constraint house_public_parcels_id_shape check (id ~ '^pubpar_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_public_parcels_unique_source unique (snapshot_id, cadastral_parcel_id)
);
