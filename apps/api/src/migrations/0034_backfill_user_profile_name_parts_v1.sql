with legacy_profiles as (
  select
    user_id,
    regexp_split_to_array(btrim(display_name), '\\s+') as name_parts
  from user_profiles
  where first_name is null
    and last_name is null
    and display_name is not null
    and array_length(regexp_split_to_array(btrim(display_name), '\\s+'), 1) >= 2
),
normalized_names as (
  select
    user_id,
    case
      when array_length(name_parts, 1) > 2 and mod(array_length(name_parts, 1), 2) = 0
        then array_to_string(name_parts[1:(array_length(name_parts, 1) / 2)], ' ')
      else name_parts[1]
    end as first_name,
    case
      when array_length(name_parts, 1) > 2 and mod(array_length(name_parts, 1), 2) = 0
        then array_to_string(name_parts[(array_length(name_parts, 1) / 2 + 1):array_length(name_parts, 1)], ' ')
      else array_to_string(name_parts[2:array_length(name_parts, 1)], ' ')
    end as last_name
  from legacy_profiles
)
update user_profiles profile
set first_name = normalized.first_name,
    last_name = normalized.last_name,
    updated_at = now()
from normalized_names normalized
where profile.user_id = normalized.user_id;
