import { Client } from "pg";

const EXPECTED_TABLES = [
  "dev_users",
  "users",
  "user_profiles",
  "magic_link_tokens",
  "auth_sessions",
  "auth_email_rate_limits",
  "houses",
  "house_memberships",
  "house_claims",
  "house_invitations",
  "house_improvement_documents",
  "house_documents",
  "house_media",
  "house_improvements",
  "maintenance_recommendation_hides",
  "maintenance_completions",
  "maintenance_tasks",
  "maintenance_recommendations",
  "house_public_units",
  "house_public_floors",
  "house_public_parcels",
  "house_public_buildings",
  "house_public_data_snapshots"
];

const PRESERVED_TABLES = [
  "schema_migrations",
  "user_roles",
  "maintenance_catalog_items"
];

// Delete explicitly in dependency order. No dynamic table discovery or CASCADE is used.
const DELETE_STEPS = [
  "house_improvement_documents",
  "house_invitations",
  "house_claims",
  "house_memberships",
  "house_documents",
  "house_media",
  "house_improvements",
  "maintenance_recommendation_hides",
  "maintenance_completions",
  "maintenance_recommendations",
  "maintenance_tasks",
  "house_public_units",
  "house_public_floors",
  "house_public_parcels",
  "house_public_buildings",
  "house_public_data_snapshots",
  "houses",
  "auth_email_rate_limits",
  "dev_users"
];

const environment = process.env.MATRIVA_ENVIRONMENT;
const confirmation = process.env.RESET_CONFIRM;
const databaseUrl = process.env.DATABASE_URL;
const dryRun = process.env.DRY_RUN === "1";

if (environment !== "qa") {
  throw new Error("Refusing QA user/house reset: MATRIVA_ENVIRONMENT must be qa.");
}
if (confirmation !== "WIPE_MATRIVA_QA_USER_HOUSE_DATA") {
  throw new Error(
    "Refusing QA user/house reset: RESET_CONFIRM must be WIPE_MATRIVA_QA_USER_HOUSE_DATA."
  );
}
if (!databaseUrl) throw new Error("Refusing QA user/house reset: DATABASE_URL is required.");

function assertSafeDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Refusing QA user/house reset: DATABASE_URL is invalid.");
  }

  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  const productionLike = /(^|[._-])(prod|production|live|primary)([._-]|$)/;

  if (productionLike.test(host) || productionLike.test(database)) {
    throw new Error("Refusing QA user/house reset: database host/name looks production-like.");
  }
  if (database === "matriva" || database === "matriva_prod") {
    throw new Error("Refusing QA user/house reset: database name is not a QA database.");
  }
}

assertSafeDatabaseUrl(databaseUrl);

const quoted = (name) => `"${name.replaceAll('"', '""')}"`;
const client = new Client({ connectionString: databaseUrl });

async function assertSchema(client) {
  const expected = [...EXPECTED_TABLES, ...PRESERVED_TABLES];
  const result = await client.query(
    `select tablename from pg_tables where schemaname = 'public' and tablename = any($1::text[])`,
    [expected]
  );
  const present = new Set(result.rows.map((row) => row.tablename));
  const missing = expected.filter((name) => !present.has(name));
  if (missing.length) {
    throw new Error(`Refusing reset: expected tables are missing: ${missing.join(", ")}.`);
  }

  const allowedSources = new Set([...EXPECTED_TABLES, ...PRESERVED_TABLES]);
  const foreignKeys = await client.query(`
    select
      source.relname as source_table,
      target.relname as target_table,
      conname
    from pg_constraint c
    join pg_class source on source.oid = c.conrelid
    join pg_namespace source_ns on source_ns.oid = source.relnamespace
    join pg_class target on target.oid = c.confrelid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    where c.contype = 'f'
      and source_ns.nspname = 'public'
      and target_ns.nspname = 'public'
      and (source.relname = any($1::text[]) or target.relname = any($1::text[]))
  `, [EXPECTED_TABLES]);

  const unknown = foreignKeys.rows.filter(
    (row) => !allowedSources.has(row.source_table) || !allowedSources.has(row.target_table)
  );
  if (unknown.length) {
    const relations = unknown
      .map((row) => `${row.source_table}->${row.target_table} (${row.conname})`)
      .join(", ");
    throw new Error(`Refusing reset: unknown public foreign-key relation(s): ${relations}.`);
  }
}

async function countRows(client, table) {
  const result = await client.query(`select count(*)::int as count from ${quoted(table)}`);
  return result.rows[0].count;
}

async function countDeletableUsers(client) {
  const result = await client.query(`
    select count(*)::int as count
    from users u
    where not exists (
      select 1 from user_roles r where r.user_id = u.id
    )
  `);
  return result.rows[0].count;
}

async function countNonAdminUserRows(client, table) {
  const result = await client.query(`
    select count(*)::int as count
    from ${quoted(table)} t
    where exists (
      select 1 from users u
      where u.id = t.user_id
        and not exists (select 1 from user_roles r where r.user_id = u.id)
    )
  `);
  return result.rows[0].count;
}

async function report(client) {
  const rows = [];
  for (const table of DELETE_STEPS) {
    rows.push({ table, rows: await countRows(client, table) });
  }
  for (const table of ["user_profiles", "magic_link_tokens", "auth_sessions"]) {
    rows.push({ table: `${table} (non-admin only)`, rows: await countNonAdminUserRows(client, table) });
  }
  rows.push({ table: "users (non-admin only)", rows: await countDeletableUsers(client) });
  const preserved = [];
  for (const table of PRESERVED_TABLES) {
    preserved.push({ table, rows: await countRows(client, table) });
  }
  return {
    delete: rows,
    deleteTotal: rows.reduce((total, row) => total + row.rows, 0),
    preserve: preserved
  };
}

await client.connect();
try {
  await client.query("begin");
  await assertSchema(client);

  const before = await report(client);
  if (dryRun) {
    await client.query("rollback");
    console.log(JSON.stringify({ event: "matriva.qa_user_house_reset_dry_run", before }));
  } else {
    for (const table of DELETE_STEPS) {
      await client.query(`delete from ${quoted(table)}`);
    }
    for (const table of ["user_profiles", "magic_link_tokens", "auth_sessions"]) {
      await client.query(`
        delete from ${quoted(table)} t
        where exists (
          select 1 from users u
          where u.id = t.user_id
            and not exists (select 1 from user_roles r where r.user_id = u.id)
        )
      `);
    }
    await client.query(`
      delete from users u
      where not exists (
        select 1 from user_roles r where r.user_id = u.id
      )
    `);
    await client.query("commit");
    console.log(JSON.stringify({ event: "matriva.qa_user_house_reset", before }));
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
