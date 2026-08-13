import assert from "node:assert/strict";

import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
assertSafeSmokeDatabase(databaseUrl);

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const result = await pool.query(
    `select gt.guide_key, gv.id, gv.title, gv.publication_status, gv.validation_status,
            count(distinct gs.id)::int as section_count,
            count(distinct gva.id)::int as placement_count,
            count(distinct gh.id)::int as hotspot_count
     from guide_templates gt
     join guide_versions gv on gv.guide_template_id = gt.id
     left join guide_sections gs on gs.guide_version_id = gv.id
     left join guide_version_assets gva on gva.guide_version_id = gv.id
     left join guide_hotspots gh on gh.guide_version_asset_id = gva.id
     where gt.guide_key in ('rens_tagrender', 'tjek_fuger_vaadrum')
     group by gt.guide_key, gv.id, gv.title, gv.publication_status, gv.validation_status
     order by gt.guide_key`
  );
  const guide01 = result.rows.find((row) => row.guide_key === "rens_tagrender");
  const guide02 = result.rows.find((row) => row.guide_key === "tjek_fuger_vaadrum");
  assert.ok(guide01);
  assert.ok(guide02);
  assert.equal(guide01.id, "gver_rens_tagrender_v1");
  assert.equal(guide01.title, "Rens tagrender");
  assert.ok(["draft", "published"].includes(guide01.publication_status));
  assert.equal(guide01.section_count, 16);
  assert.equal(guide01.placement_count, 4);
  assert.equal(guide01.hotspot_count, 4);
  assert.equal(guide02.id, "gver_tjek_fuger_vaadrum_v1");
  assert.equal(guide02.title, "Tjek fuger i vådrum");
  assert.equal(guide02.publication_status, "draft");
  assert.equal(guide02.validation_status, "approved");
  assert.equal(guide02.section_count, 15);
  assert.equal(guide02.placement_count, 5);
  assert.equal(guide02.hotspot_count, 4);
  console.log(`Guide 01 intact (${guide01.publication_status}); Guide 02 draft runtime validated with ${guide02.placement_count} placements and ${guide02.hotspot_count} hotspots.`);
} finally {
  await pool.end();
}
