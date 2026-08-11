-- Guide templates are stable identities. Editorial content lives in immutable
-- published versions so later edits cannot mutate a user's existing task.
create table if not exists guide_templates (
  id text primary key,
  guide_key text not null unique,
  current_published_version_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint guide_templates_id_shape check (id ~ '^guide_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_templates_key_shape check (guide_key ~ '^[a-z][a-z0-9_]{2,79}$')
);

-- Profiles represent Matriva reference houses, not user-owned houses.
create table if not exists house_profiles (
  id text primary key,
  profile_key text not null unique,
  title text not null,
  description text,
  reference_house_label text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_profiles_id_shape check (id ~ '^hprof_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_profiles_key_shape check (profile_key ~ '^[a-z][a-z0-9_]{2,79}$')
);

-- The evaluator is intentionally data-driven. Its implementation and allowed
-- BBR facts are a later concern; each stored definition remains reproducible.
create table if not exists house_relevance_rule_sets (
  id text primary key,
  rule_set_key text not null,
  rule_set_version text not null,
  evaluator_version text not null,
  definition jsonb not null,
  status text not null default 'draft',
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint house_relevance_rule_sets_id_shape check (id ~ '^hrule_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_relevance_rule_sets_key_shape check (rule_set_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint house_relevance_rule_sets_definition_shape check (jsonb_typeof(definition) = 'object'),
  constraint house_relevance_rule_sets_status_valid check (status in ('draft', 'published', 'retired')),
  constraint house_relevance_rule_sets_published_shape check (
    (status = 'published' and published_at is not null)
    or (status <> 'published')
  )
);

create unique index if not exists house_relevance_rule_sets_key_version_uidx
  on house_relevance_rule_sets (rule_set_key, rule_set_version);

create table if not exists house_profile_rule_sets (
  id text primary key,
  house_profile_id text not null references house_profiles(id) on delete cascade,
  relevance_rule_set_id text not null references house_relevance_rule_sets(id) on delete restrict,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  constraint house_profile_rule_sets_id_shape check (id ~ '^hprule_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_profile_rule_sets_unique unique (house_profile_id, relevance_rule_set_id)
);

create table if not exists house_profile_assignments (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  house_profile_id text not null references house_profiles(id) on delete restrict,
  public_data_snapshot_id text references house_public_data_snapshots(id) on delete set null,
  relevance_rule_set_id text references house_relevance_rule_sets(id) on delete set null,
  assignment_source text not null,
  confidence text not null default 'unknown',
  reason text,
  assigned_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_by_user_id text references users(id) on delete set null,
  constraint house_profile_assignments_id_shape check (id ~ '^hpass_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_profile_assignments_source_valid check (assignment_source in ('bbr_rules', 'manual', 'fallback')),
  constraint house_profile_assignments_confidence_valid check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint house_profile_assignments_superseded_shape check (superseded_at is null or superseded_at >= assigned_at)
);

create unique index if not exists house_profile_assignments_active_house_uidx
  on house_profile_assignments (house_id)
  where superseded_at is null;

create index if not exists house_profile_assignments_house_idx
  on house_profile_assignments (house_id, assigned_at desc);

create table if not exists guide_versions (
  id text primary key,
  guide_template_id text not null references guide_templates(id) on delete cascade,
  version_number integer not null,
  locale text not null default 'da-DK',
  title text not null,
  summary text,
  search_text text not null default '',
  publication_status text not null default 'draft',
  validation_status text not null default 'not_requested',
  validation_summary text,
  content_checksum text,
  created_by_user_id text references users(id) on delete set null,
  published_by_user_id text references users(id) on delete set null,
  cloned_from_version_id text references guide_versions(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_versions_id_shape check (id ~ '^gver_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_versions_number_valid check (version_number > 0),
  constraint guide_versions_publication_valid check (publication_status in ('draft', 'published', 'archived')),
  constraint guide_versions_validation_valid check (validation_status in ('not_requested', 'in_review', 'changes_requested', 'approved')),
  constraint guide_versions_published_shape check (
    (publication_status = 'published' and validation_status = 'approved' and published_at is not null and published_by_user_id is not null)
    or (publication_status <> 'published')
  ),
  constraint guide_versions_archived_shape check (
    (publication_status = 'archived' and archived_at is not null)
    or (publication_status <> 'archived')
  ),
  constraint guide_versions_template_version_unique unique (guide_template_id, version_number),
  constraint guide_versions_id_template_unique unique (id, guide_template_id)
);

create unique index if not exists guide_versions_single_published_template_uidx
  on guide_versions (guide_template_id)
  where publication_status = 'published';

create index if not exists guide_versions_search_text_idx
  on guide_versions using gin (to_tsvector('simple', search_text));

alter table guide_templates
  add constraint guide_templates_current_published_version_fk
  foreign key (current_published_version_id, id)
  references guide_versions(id, guide_template_id)
  on delete set null (current_published_version_id);

create table if not exists guide_version_reviews (
  id text primary key,
  guide_version_id text not null references guide_versions(id) on delete cascade,
  reviewer_user_id text not null references users(id) on delete restrict,
  review_scope text not null,
  decision text not null,
  note text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint guide_version_reviews_id_shape check (id ~ '^grev_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_version_reviews_scope_valid check (review_scope in ('editorial', 'technical', 'safety', 'visual')),
  constraint guide_version_reviews_decision_valid check (decision in ('approved', 'changes_requested'))
);

create index if not exists guide_version_reviews_version_reviewed_idx
  on guide_version_reviews (guide_version_id, reviewed_at desc);

create table if not exists guide_sections (
  id text primary key,
  guide_version_id text not null references guide_versions(id) on delete cascade,
  section_type text not null,
  section_key text not null,
  position integer not null,
  title text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_sections_id_shape check (id ~ '^gsec_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_sections_type_valid check (section_type in ('introduction', 'why_it_matters', 'overview', 'tools_materials', 'safety', 'preparation', 'step', 'common_mistakes', 'completion_check', 'professional_help', 'print_note', 'custom')),
  constraint guide_sections_position_valid check (position >= 0),
  constraint guide_sections_content_shape check (jsonb_typeof(content) = 'object'),
  constraint guide_sections_version_position_unique unique (guide_version_id, position),
  constraint guide_sections_version_key_unique unique (guide_version_id, section_key)
);

create table if not exists guide_assets (
  id text primary key,
  asset_key text not null unique,
  asset_type text not null default 'image',
  storage_key text not null unique,
  mime_type text not null,
  size_bytes integer not null,
  width integer,
  height integer,
  checksum_sha256 text,
  source_type text not null,
  alt_text text,
  attribution text,
  production_metadata jsonb not null default '{}'::jsonb,
  created_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint guide_assets_id_shape check (id ~ '^gasset_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_assets_key_shape check (asset_key ~ '^[a-z][a-z0-9_]{2,119}$'),
  constraint guide_assets_type_valid check (asset_type in ('image', 'illustration', 'diagram')),
  constraint guide_assets_mime_valid check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml')),
  constraint guide_assets_size_valid check (size_bytes > 0),
  constraint guide_assets_dimensions_valid check ((width is null and height is null) or (width > 0 and height > 0)),
  constraint guide_assets_source_valid check (source_type in ('ai_generated', 'photograph', 'illustration', 'licensed', 'other')),
  constraint guide_assets_metadata_shape check (jsonb_typeof(production_metadata) = 'object')
);

create table if not exists guide_version_assets (
  id text primary key,
  guide_version_id text not null references guide_versions(id) on delete cascade,
  guide_asset_id text not null references guide_assets(id) on delete restrict,
  placement text not null,
  position integer not null,
  alt_text text,
  caption text,
  print_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_version_assets_id_shape check (id ~ '^gva_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_version_assets_placement_valid check (placement in ('cover', 'inline', 'step', 'before', 'after', 'print_appendix')),
  constraint guide_version_assets_position_valid check (position >= 0),
  constraint guide_version_assets_version_placement_position_unique unique (guide_version_id, placement, position)
);

create index if not exists guide_version_assets_version_idx
  on guide_version_assets (guide_version_id, placement, position);

create table if not exists guide_asset_profile_variants (
  id text primary key,
  base_guide_asset_id text not null references guide_assets(id) on delete cascade,
  house_profile_id text not null references house_profiles(id) on delete cascade,
  variant_guide_asset_id text not null references guide_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_asset_profile_variants_id_shape check (id ~ '^gapv_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_asset_profile_variants_no_self_reference check (base_guide_asset_id <> variant_guide_asset_id),
  constraint guide_asset_profile_variants_unique unique (base_guide_asset_id, house_profile_id)
);

create table if not exists guide_hotspots (
  id text primary key,
  guide_version_asset_id text not null references guide_version_assets(id) on delete cascade,
  hotspot_type text not null,
  position integer not null,
  x numeric(7,6) not null,
  y numeric(7,6) not null,
  title text not null,
  body text not null,
  detail_guide_asset_id text references guide_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_hotspots_id_shape check (id ~ '^ghot_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_hotspots_type_valid check (hotspot_type in ('tip', 'warning', 'checkpoint', 'correct_result')),
  constraint guide_hotspots_position_valid check (position >= 0),
  constraint guide_hotspots_coordinates_valid check (x >= 0 and x <= 1 and y >= 0 and y <= 1),
  constraint guide_hotspots_asset_position_unique unique (guide_version_asset_id, position)
);

create table if not exists guide_tags (
  id text primary key,
  tag_key text not null unique,
  label text not null,
  tag_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_tags_id_shape check (id ~ '^gtag_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_tags_key_shape check (tag_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint guide_tags_type_valid check (tag_type in ('category', 'house_part', 'material', 'problem', 'audience'))
);

create table if not exists guide_version_tags (
  guide_version_id text not null references guide_versions(id) on delete cascade,
  guide_tag_id text not null references guide_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (guide_version_id, guide_tag_id)
);

create index if not exists guide_version_tags_tag_idx
  on guide_version_tags (guide_tag_id, guide_version_id);

create table if not exists guide_search_terms (
  id text primary key,
  guide_version_id text not null references guide_versions(id) on delete cascade,
  term text not null,
  term_type text not null,
  weight smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_search_terms_id_shape check (id ~ '^gterm_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint guide_search_terms_type_valid check (term_type in ('keyword', 'synonym', 'problem', 'material', 'tag')),
  constraint guide_search_terms_weight_valid check (weight between 1 and 10),
  constraint guide_search_terms_normalized check (term = lower(trim(term))),
  constraint guide_search_terms_version_term_unique unique (guide_version_id, term)
);

create index if not exists guide_search_terms_term_idx
  on guide_search_terms (term text_pattern_ops);

create table if not exists guide_version_print_metadata (
  guide_version_id text primary key references guide_versions(id) on delete cascade,
  paper_format text not null default 'A4',
  print_title text,
  print_subtitle text,
  footer_text text,
  show_hotspot_legend boolean not null default true,
  section_order jsonb not null default '[]'::jsonb,
  render_options jsonb not null default '{}'::jsonb,
  updated_by_user_id text references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_version_print_metadata_format_valid check (paper_format in ('A4')),
  constraint guide_version_print_metadata_section_order_shape check (jsonb_typeof(section_order) = 'array'),
  constraint guide_version_print_metadata_render_options_shape check (jsonb_typeof(render_options) = 'object')
);

-- The existing catalogue remains the task/recommendation template model.
alter table maintenance_catalog_items
  add column if not exists guide_template_id text,
  add column if not exists guide_version_id text,
  add column if not exists relevance_rule_set_id text references house_relevance_rule_sets(id) on delete restrict,
  add column if not exists recommendation_generation_type text not null default 'generic',
  add column if not exists default_start_offset_days integer,
  add column if not exists default_due_offset_days integer,
  add column if not exists default_notification_lead_days integer;

alter table maintenance_catalog_items
  add constraint maintenance_catalog_items_guide_version_fk
  foreign key (guide_version_id, guide_template_id)
  references guide_versions (id, guide_template_id)
  on delete restrict;

alter table maintenance_catalog_items
  add constraint maintenance_catalog_items_generation_type_valid check (recommendation_generation_type in ('generic', 'personalized')),
  add constraint maintenance_catalog_items_guide_pair_shape check ((guide_template_id is null) = (guide_version_id is null)),
  add constraint maintenance_catalog_items_start_offset_valid check (default_start_offset_days is null or default_start_offset_days between 0 and 3650),
  add constraint maintenance_catalog_items_due_offset_valid check (default_due_offset_days is null or default_due_offset_days between 0 and 3650),
  add constraint maintenance_catalog_items_notification_lead_valid check (default_notification_lead_days is null or default_notification_lead_days between 0 and 3650),
  add constraint maintenance_catalog_items_offset_order_valid check (
    default_start_offset_days is null
    or default_due_offset_days is null
    or default_start_offset_days <= default_due_offset_days
  );

create index if not exists maintenance_catalog_items_guide_version_idx
  on maintenance_catalog_items (guide_template_id, guide_version_id)
  where guide_template_id is not null;

create table if not exists house_recommendation_analysis_jobs (
  id text primary key,
  house_id text not null references houses(id) on delete cascade,
  public_data_snapshot_id text references house_public_data_snapshots(id) on delete set null,
  requested_by_user_id text references users(id) on delete set null,
  trigger_type text not null,
  status text not null default 'queued',
  rule_set_version text,
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message_sanitized text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint house_recommendation_analysis_jobs_id_shape check (id ~ '^rjob_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint house_recommendation_analysis_jobs_trigger_valid check (trigger_type in ('house_created', 'public_data_refreshed', 'manual', 'template_changed')),
  constraint house_recommendation_analysis_jobs_status_valid check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  constraint house_recommendation_analysis_jobs_attempt_valid check (attempt_count >= 0),
  constraint house_recommendation_analysis_jobs_timing_valid check (
    (status = 'queued' and started_at is null and finished_at is null)
    or (status = 'running' and started_at is not null and finished_at is null)
    or (status in ('succeeded', 'failed', 'cancelled') and finished_at is not null)
  )
);

create unique index if not exists house_recommendation_analysis_jobs_active_house_uidx
  on house_recommendation_analysis_jobs (house_id)
  where status in ('queued', 'running');

create index if not exists house_recommendation_analysis_jobs_claim_idx
  on house_recommendation_analysis_jobs (status, available_at, created_at)
  where status = 'queued';

alter table maintenance_recommendations
  add column if not exists guide_template_id text,
  add column if not exists guide_version_id text,
  add column if not exists relevance_rule_set_id text references house_relevance_rule_sets(id) on delete set null,
  add column if not exists generation_type text not null default 'generic',
  add column if not exists analysis_job_id text references house_recommendation_analysis_jobs(id) on delete set null,
  add column if not exists suggested_start_date date,
  add column if not exists task_default_snapshot jsonb;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_guide_version_fk
  foreign key (guide_version_id, guide_template_id)
  references guide_versions (id, guide_template_id)
  on delete restrict;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_generation_type_valid check (generation_type in ('generic', 'personalized')),
  add constraint maintenance_recommendations_guide_pair_shape check ((guide_template_id is null) = (guide_version_id is null)),
  add constraint maintenance_recommendations_suggested_date_order_valid check (
    suggested_start_date is null
    or suggested_due_date is null
    or suggested_start_date <= suggested_due_date
  ),
  add constraint maintenance_recommendations_task_default_snapshot_shape check (
    task_default_snapshot is null or jsonb_typeof(task_default_snapshot) = 'object'
  );

create index if not exists maintenance_recommendations_analysis_job_idx
  on maintenance_recommendations (analysis_job_id)
  where analysis_job_id is not null;

alter table maintenance_tasks
  add column if not exists guide_template_id text,
  add column if not exists guide_version_id text,
  add column if not exists creation_context text not null default 'manual',
  add column if not exists start_date date;

update maintenance_tasks
set creation_context = 'recommendation_acceptance'
where source = 'recommendation_accepted' and creation_context = 'manual';

alter table maintenance_tasks
  add constraint maintenance_tasks_guide_version_fk
  foreign key (guide_version_id, guide_template_id)
  references guide_versions (id, guide_template_id)
  on delete restrict;

alter table maintenance_tasks
  add constraint maintenance_tasks_creation_context_valid check (creation_context in ('manual', 'recommendation_acceptance', 'guide_library')),
  add constraint maintenance_tasks_guide_pair_shape check ((guide_template_id is null) = (guide_version_id is null));

alter table maintenance_tasks
  drop constraint if exists maintenance_tasks_timing_shape;

alter table maintenance_tasks
  add constraint maintenance_tasks_timing_shape check (
    (
      timing_type = 'specific_deadline'
      and due_date is not null
      and season is null
      and (start_date is null or start_date <= due_date)
    )
    or (
      timing_type = 'seasonal_window'
      and due_date is null
      and start_date is null
      and season is not null
    )
    or (
      timing_type = 'none'
      and due_date is null
      and start_date is null
      and season is null
    )
  );

alter table maintenance_recommendations
  drop constraint if exists maintenance_recommendations_timing_shape;

alter table maintenance_recommendations
  add constraint maintenance_recommendations_timing_shape check (
    (
      timing_type = 'specific_deadline'
      and due_date is not null
      and season is null
      and (suggested_start_date is null or suggested_start_date <= due_date)
    )
    or (
      timing_type = 'seasonal_window'
      and due_date is null
      and suggested_start_date is null
      and season is not null
    )
    or (
      timing_type = 'none'
      and due_date is null
      and suggested_start_date is null
      and season is null
    )
  );

create index if not exists maintenance_tasks_guide_version_idx
  on maintenance_tasks (guide_template_id, guide_version_id)
  where guide_template_id is not null;

create table if not exists maintenance_recommendation_notifications (
  id text primary key,
  recommendation_id text not null references maintenance_recommendations(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  skipped_at timestamptz,
  failed_at timestamptz,
  delivery_key text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_recommendation_notifications_id_shape check (id ~ '^mrecnot_[a-z0-9][a-z0-9_-]{7,63}$'),
  constraint maintenance_recommendation_notifications_channel_valid check (channel in ('in_app', 'push', 'email')),
  constraint maintenance_recommendation_notifications_status_valid check (status in ('pending', 'sent', 'skipped', 'failed')),
  constraint maintenance_recommendation_notifications_delivery_shape check (
    (status = 'pending' and delivered_at is null and skipped_at is null and failed_at is null)
    or (status = 'sent' and delivered_at is not null and skipped_at is null and failed_at is null)
    or (status = 'skipped' and delivered_at is null and skipped_at is not null and failed_at is null)
    or (status = 'failed' and delivered_at is null and skipped_at is null and failed_at is not null)
  ),
  constraint maintenance_recommendation_notifications_user_channel_unique unique (recommendation_id, user_id, channel)
);

create index if not exists maintenance_recommendation_notifications_pending_idx
  on maintenance_recommendation_notifications (status, scheduled_at)
  where status = 'pending';

-- Published guide content is append-only: editorial changes must be made in a
-- new draft version, preserving references from recommendations and tasks.
create or replace function assert_guide_version_content_mutable()
returns trigger
language plpgsql
as $$
declare
  target_version_id text;
  current_status text;
begin
  if tg_op = 'DELETE' then
    target_version_id := old.guide_version_id;
  else
    target_version_id := new.guide_version_id;
  end if;
  select publication_status into current_status from guide_versions where id = target_version_id;

  if current_status in ('published', 'archived') then
    raise exception 'Guide version % is immutable after publication.', target_version_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function assert_guide_hotspot_version_mutable()
returns trigger
language plpgsql
as $$
declare
  target_asset_id text;
  target_version_id text;
  current_status text;
begin
  if tg_op = 'DELETE' then
    target_asset_id := old.guide_version_asset_id;
  else
    target_asset_id := new.guide_version_asset_id;
  end if;

  select guide_version_id into target_version_id
  from guide_version_assets
  where id = target_asset_id;

  select publication_status into current_status from guide_versions where id = target_version_id;

  if current_status in ('published', 'archived') then
    raise exception 'Guide version % is immutable after publication.', target_version_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function refresh_guide_version_search_text()
returns trigger
language plpgsql
as $$
declare
  target_version_id text;
begin
  if tg_op = 'DELETE' then
    target_version_id := old.guide_version_id;
  else
    target_version_id := new.guide_version_id;
  end if;

  update guide_versions gv
  set
    search_text = concat_ws(
      ' ',
      gv.title,
      gv.summary,
      coalesce((
        select string_agg(concat_ws(' ', section.title, section.content::text), ' ' order by section.position)
        from guide_sections section
        where section.guide_version_id = target_version_id
      ), '')
    ),
    updated_at = now()
  where gv.id = target_version_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger guide_sections_require_mutable_version
before insert or update or delete on guide_sections
for each row execute function assert_guide_version_content_mutable();

create trigger guide_sections_refresh_search_text
after insert or update or delete on guide_sections
for each row execute function refresh_guide_version_search_text();

create trigger guide_version_assets_require_mutable_version
before insert or update or delete on guide_version_assets
for each row execute function assert_guide_version_content_mutable();

create trigger guide_hotspots_require_mutable_version
before insert or update or delete on guide_hotspots
for each row execute function assert_guide_hotspot_version_mutable();

create trigger guide_search_terms_require_mutable_version
before insert or update or delete on guide_search_terms
for each row execute function assert_guide_version_content_mutable();

create trigger guide_version_tags_require_mutable_version
before insert or update or delete on guide_version_tags
for each row execute function assert_guide_version_content_mutable();

create trigger guide_print_metadata_require_mutable_version
before insert or update or delete on guide_version_print_metadata
for each row execute function assert_guide_version_content_mutable();
