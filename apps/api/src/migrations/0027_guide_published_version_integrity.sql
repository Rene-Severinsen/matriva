-- A template's current pointer is the single current version. Older reviewed
-- versions remain published as immutable history, so a successor can be
-- published and selected before an older version is archived.
drop index if exists guide_versions_single_published_template_uidx;

create or replace function assert_guide_template_current_version_published()
returns trigger
language plpgsql
as $$
declare
  version_status text;
begin
  if new.current_published_version_id is null then
    return new;
  end if;

  select publication_status into version_status
  from guide_versions
  where id = new.current_published_version_id
    and guide_template_id = new.id;

  if version_status is distinct from 'published' then
    raise exception 'Current guide version must belong to this template and be published.';
  end if;

  return new;
end;
$$;

create or replace function protect_published_guide_version()
returns trigger
language plpgsql
as $$
begin
  if old.publication_status in ('published', 'archived')
    and (new.title is distinct from old.title or new.summary is distinct from old.summary) then
    raise exception 'Published guide version editorial content is immutable.';
  end if;

  if old.publication_status = 'published'
    and new.publication_status <> 'published'
    and exists (
      select 1
      from guide_templates
      where current_published_version_id = old.id
    ) then
    raise exception 'Select another published guide version before unpublishing the current version.';
  end if;

  return new;
end;
$$;

create trigger guide_templates_current_version_must_be_published
before insert or update of current_published_version_id on guide_templates
for each row execute function assert_guide_template_current_version_published();

create trigger guide_versions_protect_published_editorial_content
before update on guide_versions
for each row execute function protect_published_guide_version();
