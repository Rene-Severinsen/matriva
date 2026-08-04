alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_recurrence_interval_valid;

alter table maintenance_tasks
  add constraint maintenance_tasks_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly',
      'every_2_years', 'every_3_years', 'every_5_years', 'every_10_years'
    )
  );

alter table maintenance_recommendations
  drop constraint if exists maintenance_recommendations_recurrence_interval_valid;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly',
      'every_2_years', 'every_3_years', 'every_5_years', 'every_10_years'
    )
  );

alter table maintenance_completions
  drop constraint if exists maintenance_completions_recurrence_interval_valid;

alter table maintenance_completions
  add constraint maintenance_completions_recurrence_interval_valid check (
    recurrence_interval is null or recurrence_interval in (
      'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly',
      'every_2_years', 'every_3_years', 'every_5_years', 'every_10_years'
    )
  );

alter table maintenance_catalog_items
  drop constraint if exists maintenance_catalog_items_recurrence_valid;

alter table maintenance_catalog_items
  add constraint maintenance_catalog_items_recurrence_valid check (
    default_recurrence_interval in (
      'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly',
      'every_2_years', 'every_3_years', 'every_5_years', 'every_10_years'
    )
  );
