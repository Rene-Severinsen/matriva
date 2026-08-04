import { Client } from "pg";

const environment = process.env.MATRIVA_ENVIRONMENT;
const confirmation = process.env.RESET_CONFIRM;
const databaseUrl = process.env.DATABASE_URL;

if (environment !== "local" && environment !== "qa") {
  throw new Error("Refusing reset: MATRIVA_ENVIRONMENT must be local or qa.");
}
if (confirmation !== "WIPE_MATRIVA_TEST_DATA") {
  throw new Error("Refusing reset: RESET_CONFIRM must be WIPE_MATRIVA_TEST_DATA.");
}
if (!databaseUrl) throw new Error("Refusing reset: DATABASE_URL is required.");

const url = new URL(databaseUrl);
const forbidden = new Set(["prod", "production", "matriva", "matriva_prod"]);
if (forbidden.has(url.hostname.toLowerCase()) || forbidden.has(url.pathname.slice(1).toLowerCase())) {
  throw new Error("Refusing reset: the configured database is not an explicitly test database.");
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("begin");
  const tables = await client.query(`select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`);
  const names = tables.rows.map(({ tablename }) => `"${String(tablename).replaceAll('"', '""')}"`);
  if (names.length) await client.query(`truncate table ${names.join(", ")} restart identity cascade`);
  await client.query("commit");
  console.log(JSON.stringify({ event: "matriva.test_database_reset", environment, tableCount: names.length }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
