import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const executeCleanup =
  process.env.MATRIVA_CONFIRM_DEV_FIXTURE_CLEANUP === "true";

assertSafeSmokeDatabase(databaseUrl);

const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();

async function fixtureCounts() {
  const result = await client.query(`
    with test_users as (
      select id from users where email like '%@example.test'
    ),
    test_houses as (
      select id from houses where user_id in (select id from test_users)
    )
    select 'users' as table_name, count(*)::int as rows
      from users where id in (select id from test_users)
    union all select 'user_profiles', count(*)::int
      from user_profiles where user_id in (select id from test_users)
    union all select 'magic_link_tokens', count(*)::int
      from magic_link_tokens where user_id in (select id from test_users)
    union all select 'auth_sessions', count(*)::int
      from auth_sessions where user_id in (select id from test_users)
    union all select 'auth_email_rate_limits', count(*)::int
      from auth_email_rate_limits where normalized_email like '%@example.test'
    union all select 'houses', count(*)::int
      from houses where id in (select id from test_houses)
    union all select 'maintenance_tasks', count(*)::int
      from maintenance_tasks where user_id in (select id from test_users)
    union all select 'maintenance_recommendations', count(*)::int
      from maintenance_recommendations where user_id in (select id from test_users)
    union all select 'maintenance_completions', count(*)::int
      from maintenance_completions where user_id in (select id from test_users)
    union all select 'maintenance_recommendation_hides', count(*)::int
      from maintenance_recommendation_hides
      where house_id in (select id from test_houses)
    union all select 'house_documents', count(*)::int
      from house_documents where user_id in (select id from test_users)
    union all select 'house_improvements', count(*)::int
      from house_improvements where user_id in (select id from test_users)
    union all select 'house_media', count(*)::int
      from house_media where user_id in (select id from test_users)
    union all select 'house_public_data_snapshots', count(*)::int
      from house_public_data_snapshots
      where house_id in (select id from test_houses)
    union all select 'house_public_buildings', count(*)::int
      from house_public_buildings
      where house_id in (select id from test_houses)
    union all select 'house_public_units', count(*)::int
      from house_public_units
      where building_id in (
        select id from house_public_buildings
        where house_id in (select id from test_houses)
      )
    union all select 'house_public_floors', count(*)::int
      from house_public_floors
      where building_id in (
        select id from house_public_buildings
        where house_id in (select id from test_houses)
      )
    union all select 'house_public_parcels', count(*)::int
      from house_public_parcels
      where snapshot_id in (
        select id from house_public_data_snapshots
        where house_id in (select id from test_houses)
      )
    union all select 'user_roles', count(*)::int
      from user_roles where user_id in (select id from test_users)
    order by table_name
  `);

  return result.rows;
}

try {
  await client.query("begin");
  const before = await fixtureCounts();

  console.log(
    executeCleanup
      ? "Confirmed local fixture cleanup"
      : "Dry-run only; no database rows will be deleted"
  );
  console.table(before);

  if (executeCleanup) {
    await client.query(
      "delete from auth_email_rate_limits where normalized_email like '%@example.test'"
    );
    await client.query("delete from users where email like '%@example.test'");
    const after = await fixtureCounts();
    console.log("Counts after cleanup");
    console.table(after);
    await client.query("commit");
  } else {
    console.log(
      "Deletion order would be auth_email_rate_limits, then users with FK cascades."
    );
    await client.query("rollback");
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
