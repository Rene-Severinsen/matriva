import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";

assertSafeSmokeDatabase(databaseUrl);

const requiredTables = [
  "guide_templates",
  "guide_versions",
  "guide_version_reviews",
  "guide_sections",
  "guide_assets",
  "guide_version_assets",
  "guide_asset_profile_variants",
  "guide_hotspots",
  "guide_tags",
  "guide_version_tags",
  "guide_search_terms",
  "guide_version_print_metadata",
  "house_profiles",
  "house_profile_rule_sets",
  "house_profile_assignments",
  "house_relevance_rule_sets",
  "house_recommendation_analysis_jobs",
  "maintenance_recommendation_notifications"
];

const requiredColumns = {
  maintenance_catalog_items: [
    "guide_template_id",
    "guide_version_id",
    "relevance_rule_set_id",
    "recommendation_generation_type",
    "default_start_offset_days",
    "default_due_offset_days",
    "default_notification_lead_days"
  ],
  maintenance_recommendations: [
    "guide_template_id",
    "guide_version_id",
    "generation_type",
    "analysis_job_id",
    "suggested_start_date",
    "task_default_snapshot"
  ],
  maintenance_tasks: [
    "guide_template_id",
    "guide_version_id",
    "creation_context",
    "start_date"
  ]
};

const requiredConstraints = [
  "guide_templates_current_published_version_fk",
  "guide_versions_published_shape",
  "maintenance_catalog_items_guide_version_fk",
  "maintenance_recommendations_guide_version_fk",
  "maintenance_tasks_guide_version_fk",
  "maintenance_tasks_guide_pair_shape",
  "maintenance_recommendations_guide_pair_shape"
];

const requiredTriggers = [
  "guide_templates_current_version_must_be_published",
  "guide_versions_protect_published_editorial_content"
];

const seededGuides = [
  {
    templateId: "guide_rens_tagrender",
    guideKey: "rens_tagrender",
    versionId: "gver_rens_tagrender_v1",
    title: "Rens tagrender",
    catalogKey: "gutters_clean",
    recurrenceInterval: "half_yearly",
    expectedSectionCount: 16,
    expectedSearchTerms: 7,
    expectedTags: 5,
    expectedAssetPlacementCount: 4,
    expectedHotspotCount: 4
  },
  {
    templateId: "guide_tjek_fuger_vaadrum",
    guideKey: "tjek_fuger_vaadrum",
    versionId: "gver_tjek_fuger_vaadrum_v1",
    title: "Tjek fuger i vådrum",
    catalogKey: "wetroom_joints_check",
    recurrenceInterval: "yearly",
    expectedSectionCount: 15,
    expectedSearchTerms: 7,
    expectedTags: 6,
    expectedAssetPlacementCount: 0,
    expectedHotspotCount: 0
  }
];

const seededHouseProfile = {
  id: "hprof_matriva_modern_2023",
  profileKey: "matriva_modern_2023",
  title: "Matriva Modern 2023",
  referenceHouseLabel: "Matriva Modern 2023 · House A"
};

function opaqueSuffix() {
  return randomUUID().replaceAll("-", "").slice(0, 20);
}

async function expectStatementFailure(client, operation, message) {
  await client.query("savepoint expected_failure");

  try {
    await operation();
    assert.fail(message);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
  } finally {
    await client.query("rollback to savepoint expected_failure");
    await client.query("release savepoint expected_failure");
  }
}

async function run() {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    const migrations = await client.query(
      "select name from schema_migrations where name = any($1::text[])",
      [[
        "0026_guides_recommendations_content_model_v1.sql",
        "0027_guide_published_version_integrity.sql"
      ]]
    );
    assert.deepEqual(
      new Set(migrations.rows.map((row) => row.name)),
      new Set([
        "0026_guides_recommendations_content_model_v1.sql",
        "0027_guide_published_version_integrity.sql"
      ]),
      "Guide model migrations must be recorded."
    );

    const tables = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1::text[])",
      [requiredTables]
    );
    assert.deepEqual(
      new Set(tables.rows.map((row) => row.table_name)),
      new Set(requiredTables),
      "Every guide content-model table must exist."
    );

    for (const [tableName, columns] of Object.entries(requiredColumns)) {
      const result = await client.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = any($2::text[])",
        [tableName, columns]
      );
      assert.deepEqual(
        new Set(result.rows.map((row) => row.column_name)),
        new Set(columns),
        `${tableName} must expose its guide-model columns.`
      );
    }

    const constraints = await client.query(
      "select conname from pg_constraint where conname = any($1::text[])",
      [requiredConstraints]
    );
    assert.deepEqual(
      new Set(constraints.rows.map((row) => row.conname)),
      new Set(requiredConstraints),
      "Guide lineage constraints must exist."
    );

    const triggers = await client.query(
      "select tgname from pg_trigger where not tgisinternal and tgname = any($1::text[])",
      [requiredTriggers]
    );
    assert.deepEqual(
      new Set(triggers.rows.map((row) => row.tgname)),
      new Set(requiredTriggers),
      "Published guide integrity triggers must exist."
    );

    const seedRows = await client.query(
      `
        select
          gt.id as template_id,
          gt.guide_key,
          gt.current_published_version_id,
          gv.id as version_id,
          gv.version_number,
          gv.title,
          gv.publication_status,
          gv.validation_status,
          count(distinct gs.id)::int as section_count,
          count(distinct gst.id)::int as search_term_count,
          count(distinct gvt.guide_tag_id)::int as tag_count,
          count(distinct gpm.guide_version_id)::int as print_metadata_count,
          count(distinct gva.id)::int as asset_placement_count,
          count(distinct gh.id)::int as hotspot_count,
          count(distinct gr.id)::int as review_count
        from guide_templates gt
        join guide_versions gv on gv.guide_template_id = gt.id
        left join guide_sections gs on gs.guide_version_id = gv.id
        left join guide_search_terms gst on gst.guide_version_id = gv.id
        left join guide_version_tags gvt on gvt.guide_version_id = gv.id
        left join guide_version_print_metadata gpm on gpm.guide_version_id = gv.id
        left join guide_version_assets gva on gva.guide_version_id = gv.id
        left join guide_hotspots gh on gh.guide_version_asset_id = gva.id
        left join guide_version_reviews gr on gr.guide_version_id = gv.id
        where gt.id = any($1::text[])
        group by gt.id, gt.guide_key, gt.current_published_version_id, gv.id, gv.version_number, gv.title, gv.publication_status, gv.validation_status
        order by gt.guide_key
      `,
      [seededGuides.map((guide) => guide.templateId)]
    );
    assert.equal(seedRows.rowCount, seededGuides.length, "Both initial guide templates must be seeded.");

    for (const guide of seededGuides) {
      const row = seedRows.rows.find((candidate) => candidate.template_id === guide.templateId);
      assert.deepEqual(
        row,
        {
          template_id: guide.templateId,
          guide_key: guide.guideKey,
          current_published_version_id: null,
          version_id: guide.versionId,
          version_number: 1,
          title: guide.title,
          publication_status: "draft",
          validation_status: "not_requested",
          section_count: guide.expectedSectionCount,
          search_term_count: guide.expectedSearchTerms,
          tag_count: guide.expectedTags,
          print_metadata_count: 1,
          asset_placement_count: guide.expectedAssetPlacementCount,
          hotspot_count: guide.expectedHotspotCount,
          review_count: 0
        },
        `${guide.title} must remain an unreviewed draft with complete structured seed data and only its preserved pilot assets.`
      );
    }

    const catalogLinks = await client.query(
      `
        select catalog_key, guide_template_id, guide_version_id, default_recurrence_interval
        from maintenance_catalog_items
        where catalog_key = any($1::text[])
        order by catalog_key
      `,
      [seededGuides.map((guide) => guide.catalogKey)]
    );
    assert.deepEqual(
      catalogLinks.rows,
      seededGuides
        .slice()
        .sort((a, b) => a.catalogKey.localeCompare(b.catalogKey))
        .map((guide) => ({
          catalog_key: guide.catalogKey,
          guide_template_id: guide.templateId,
          guide_version_id: guide.versionId,
          default_recurrence_interval: guide.recurrenceInterval
        })),
      "Initial guides must link to their existing task/recommendation templates."
    );

    const reviewPlans = await client.query(
      `
        select guide_version_id, content->'requiredScopes' as required_scopes
        from guide_sections
        where guide_version_id = any($1::text[]) and section_key = 'review_plan'
        order by guide_version_id
      `,
      [seededGuides.map((guide) => guide.versionId)]
    );
    assert.deepEqual(
      reviewPlans.rows,
      seededGuides.map((guide) => ({
        guide_version_id: guide.versionId,
        required_scopes: ["editorial", "technical", "safety", "visual"]
      })),
      "Every initial guide must prepare the four required review scopes without creating fake reviews."
    );

    const houseProfile = await client.query(
      `
        select id, profile_key, title, reference_house_label
        from house_profiles
        where id = $1
      `,
      [seededHouseProfile.id]
    );
    assert.deepEqual(
      houseProfile.rows,
      [{
        id: seededHouseProfile.id,
        profile_key: seededHouseProfile.profileKey,
        title: seededHouseProfile.title,
        reference_house_label: seededHouseProfile.referenceHouseLabel
      }],
      "The Matriva Modern 2023 House A reference profile must be seeded without an automatic BBR assignment."
    );

    const target = await client.query(
      `select h.id as house_id, hm.user_id
       from houses h
       join house_memberships hm on hm.house_id = h.id and hm.status = 'active'
       where h.status = 'saved'
       order by h.created_at
       limit 1`
    );
    assert.ok(target.rows[0], "A saved DEV house with an active member is required.");

    const suffix = opaqueSuffix();
    const ids = {
      template: `guide_model_${suffix}`,
      version: `gver_model_${suffix}`,
      nextVersion: `gver_model_next_${suffix}`,
      asset: `gasset_model_${suffix}`,
      variantAsset: `gasset_variant_${suffix}`,
      versionAsset: `gva_model_${suffix}`,
      hotspot: `ghot_model_${suffix}`,
      profile: `hprof_model_${suffix}`,
      rule: `hrule_model_${suffix}`,
      assignment: `hpass_model_${suffix}`,
      catalog: `mcat_model_${suffix}`,
      job: `rjob_model_${suffix}`,
      recommendation: `mrec_model_${suffix}`,
      task: `task_model_${suffix}`,
      notification: `mrecnot_model_${suffix}`
    };
    const keys = {
      guide: `guide_model_${suffix}`,
      profile: `profile_model_${suffix}`,
      rule: `rule_model_${suffix}`,
      catalog: `catalog_model_${suffix}`
    };
    const house = target.rows[0];

    await client.query("begin");
    try {
      await client.query(
        "insert into guide_templates (id, guide_key) values ($1, $2)",
        [ids.template, keys.guide]
      );
      await client.query(
        "insert into guide_versions (id, guide_template_id, version_number, title, summary) values ($1, $2, 1, 'Modeltest guide', 'Første udkast')",
        [ids.version, ids.template]
      );
      await client.query(
        "update guide_versions set title = 'Redigeret draft', summary = 'Redigeret draft-summary' where id = $1",
        [ids.version]
      );
      const editedDraft = await client.query(
        "select title, summary from guide_versions where id = $1",
        [ids.version]
      );
      assert.deepEqual(editedDraft.rows[0], {
        title: "Redigeret draft",
        summary: "Redigeret draft-summary"
      });
      await expectStatementFailure(
        client,
        () => client.query(
          "update guide_templates set current_published_version_id = $1 where id = $2",
          [ids.version, ids.template]
        ),
        "A template must not point at a draft guide version."
      );
      await client.query(
        "insert into guide_sections (id, guide_version_id, section_type, section_key, position, content) values ($1, $2, 'introduction', 'intro', 0, $3::jsonb)",
        [ids.version.replace("gver_", "gsec_"), ids.version, JSON.stringify({ text: "Modeltest indhold" })]
      );
      await client.query(
        "insert into guide_assets (id, asset_key, storage_key, mime_type, size_bytes, source_type) values ($1, $2, $3, 'image/png', 1, 'ai_generated'), ($4, $5, $6, 'image/png', 1, 'illustration')",
        [
          ids.asset,
          `asset_model_${suffix}`,
          `guides/model/${suffix}.png`,
          ids.variantAsset,
          `asset_variant_${suffix}`,
          `guides/model/${suffix}-variant.png`
        ]
      );
      await client.query(
        "insert into house_profiles (id, profile_key, title) values ($1, $2, 'Modeltest-profil')",
        [ids.profile, keys.profile]
      );
      await client.query(
        "insert into guide_version_assets (id, guide_version_id, guide_asset_id, placement, position) values ($1, $2, $3, 'cover', 0)",
        [ids.versionAsset, ids.version, ids.asset]
      );
      await client.query(
        "insert into guide_asset_profile_variants (id, base_guide_asset_id, house_profile_id, variant_guide_asset_id) values ($1, $2, $3, $4)",
        [`gapv_model_${suffix}`, ids.asset, ids.profile, ids.variantAsset]
      );
      await client.query(
        "insert into guide_hotspots (id, guide_version_asset_id, hotspot_type, position, x, y, title, body) values ($1, $2, 'checkpoint', 0, 0.5, 0.5, 'Kontrolpunkt', 'Struktureret hotspot')",
        [ids.hotspot, ids.versionAsset]
      );
      await client.query(
        "insert into house_relevance_rule_sets (id, rule_set_key, rule_set_version, evaluator_version, definition) values ($1, $2, 'v1', 'v1', $3::jsonb)",
        [ids.rule, keys.rule, JSON.stringify({ all: [{ fact: "building.constructionYear", operator: "exists" }] })]
      );
      await client.query(
        "insert into house_profile_assignments (id, house_id, house_profile_id, relevance_rule_set_id, assignment_source, reason, superseded_at) values ($1, $2, $3, $4, 'fallback', 'Modeltest', now())",
        [ids.assignment, house.house_id, ids.profile, ids.rule]
      );
      await client.query(
        `insert into maintenance_catalog_items (
          id, catalog_key, catalog_version, title, short_description, season,
          recommended_period, default_recurrence_interval, priority, eligibility_rules,
          disclaimer_class, is_active, guide_template_id, guide_version_id,
          relevance_rule_set_id, recommendation_generation_type, default_start_offset_days,
          default_due_offset_days, default_notification_lead_days
        ) values (
          $1, $2, 'v1', 'Modeltest template', 'Modeltest template', 'all_year',
          $3::jsonb, 'yearly', 'normal', $4::jsonb,
          'general', false, $5, $6, $7, 'personalized', 0, 7, 3
        )`,
        [
          ids.catalog,
          keys.catalog,
          JSON.stringify({ type: "all_year" }),
          JSON.stringify({ type: "universal_house" }),
          ids.template,
          ids.version,
          ids.rule
        ]
      );
      await client.query(
        "insert into house_recommendation_analysis_jobs (id, house_id, trigger_type) values ($1, $2, 'manual')",
        [ids.job, house.house_id]
      );
      await client.query(
        `insert into maintenance_recommendations (
          id, house_id, user_id, source_type, title, description,
          recommended_timing_label, timing_type, due_date, provenance,
          recommendation_key, version_key, catalog_item_id, catalog_key, catalog_version,
          recommended_period, period_key, suggested_due_date, priority, disclaimer_class,
          why, guide_template_id, guide_version_id, relevance_rule_set_id,
          generation_type, analysis_job_id
        ) values (
          $1, $2, $3, 'matriva_catalog', 'Modeltest anbefaling', 'Modeltest anbefaling',
          'Inden for 7 dage', 'specific_deadline', current_date + 7, $4::jsonb,
          $5, $6, $7, $8, 'v1', $9::jsonb, $10, current_date + 7, 'normal', 'general',
          'Modeltest', $11, $12, $13, 'personalized', $14
        )`,
        [
          ids.recommendation,
          house.house_id,
          house.user_id,
          JSON.stringify({ extractionMethod: "model_test" }),
          keys.catalog,
          `model-${suffix}`,
          ids.catalog,
          keys.catalog,
          JSON.stringify({ type: "all_year" }),
          `model-${suffix}`,
          ids.template,
          ids.version,
          ids.rule,
          ids.job
        ]
      );
      await client.query(
        "insert into maintenance_recommendation_notifications (id, recommendation_id, user_id, channel) values ($1, $2, $3, 'in_app')",
        [ids.notification, ids.recommendation, house.user_id]
      );
      await client.query(
        `insert into maintenance_tasks (
          id, house_id, user_id, title, source, status, timing_type,
          price_currency, guide_template_id, guide_version_id, creation_context
        ) values ($1, $2, $3, 'Modeltest opgave', 'user_created', 'planned', 'none', 'DKK', $4, $5, 'guide_library')`,
        [ids.task, house.house_id, house.user_id, ids.template, ids.version]
      );

      await client.query(
        `update guide_versions
         set validation_status = 'approved', publication_status = 'published',
             published_at = now(), published_by_user_id = $2
         where id = $1`,
        [ids.version, house.user_id]
      );
      await client.query(
        "update guide_templates set current_published_version_id = $1 where id = $2",
        [ids.version, ids.template]
      );
      await expectStatementFailure(
        client,
        () => client.query(
          "update guide_versions set title = 'Må ikke ændres' where id = $1",
          [ids.version]
        ),
        "Published guide titles must be immutable."
      );
      await expectStatementFailure(
        client,
        () => client.query(
          "update guide_versions set summary = 'Må ikke ændres' where id = $1",
          [ids.version]
        ),
        "Published guide summaries must be immutable."
      );
      await client.query(
        "insert into guide_versions (id, guide_template_id, version_number, title, summary) values ($1, $2, 2, 'Nyt draft', 'Nyt draft-summary')",
        [ids.nextVersion, ids.template]
      );

      const lineage = await client.query(
        `select
           (select guide_version_id from maintenance_catalog_items where id = $1) as catalog_version_id,
           (select guide_version_id from maintenance_recommendations where id = $2) as recommendation_version_id,
           (select guide_version_id from maintenance_tasks where id = $3) as task_version_id,
           (select variant_guide_asset_id from guide_asset_profile_variants where base_guide_asset_id = $4 and house_profile_id = $5) as profile_asset_id,
           (select status from house_recommendation_analysis_jobs where id = $6) as job_status,
           (select status from maintenance_recommendation_notifications where id = $7) as notification_status`,
        [ids.catalog, ids.recommendation, ids.task, ids.asset, ids.profile, ids.job, ids.notification]
      );
      assert.deepEqual(lineage.rows[0], {
        catalog_version_id: ids.version,
        recommendation_version_id: ids.version,
        task_version_id: ids.version,
        profile_asset_id: ids.variantAsset,
        job_status: "queued",
        notification_status: "pending"
      });
    } finally {
      await client.query("rollback");
    }

    console.log("Guide content model schema and lineage checks passed.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
