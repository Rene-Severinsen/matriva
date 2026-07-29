update maintenance_tasks
set
  recommendation = case
    when recommendation is null then null
    else recommendation - 'componentKey'
  end,
  origin_snapshot = case
    when origin_snapshot is null then null
    else origin_snapshot - 'componentKey'
  end
where
  recommendation ? 'componentKey'
  or origin_snapshot ? 'componentKey';

alter table maintenance_catalog_items
  drop constraint if exists maintenance_catalog_items_component_valid;

alter table maintenance_tasks
  drop column if exists component_key;

alter table maintenance_recommendations
  drop column if exists component_key;

alter table maintenance_completions
  drop column if exists component_key;

alter table maintenance_catalog_items
  drop column if exists component_key;
