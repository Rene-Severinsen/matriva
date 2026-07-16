alter table house_public_buildings
  add column remodel_or_extension_year integer,
  add column commercial_area_m2 integer,
  add column footprint_area_m2 integer,
  add column integrated_garage_m2 integer,
  add column integrated_carport_m2 integer,
  add column integrated_outbuilding_m2 integer,
  add column integrated_conservatory_m2 integer,
  add column covered_area_m2 integer,
  add column other_area_m2 integer,
  add column registered_floor_count integer,
  add column outer_wall_code text,
  add column roof_code text,
  add column supplementary_outer_wall_code text,
  add column heating_installation_code text,
  add column heating_source_code text,
  add column supplementary_heating_code text;

alter table house_public_units
  add column housing_type_code text,
  add column commercial_area_m2 integer,
  add column physical_residential_area_m2 integer,
  add column physical_commercial_area_m2 integer,
  add column area_source_code text,
  add column bathroom_count integer,
  add column flush_toilet_count integer,
  add column toilet_type_code text,
  add column bath_type_code text,
  add column kitchen_type_code text,
  add column flex_home_permission_code text,
  add column address_function_code text,
  add column registered_area_1_m2 integer,
  add column registered_area_2_m2 integer,
  add column registered_area_3_m2 integer;

alter table house_public_floors
  add column utilised_attic_area_m2 integer,
  add column commercial_basement_area_m2 integer,
  add column floor_type_code text,
  add column access_area_m2 integer;
