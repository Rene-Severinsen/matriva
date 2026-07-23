import pg from "pg";

const allowedDatabaseNames = new Set(["matriva_dev", "matriva_test"]);
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertSafeSmokeDatabase(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (
    parsed.protocol !== "postgresql:" ||
    !allowedHosts.has(parsed.hostname) ||
    !allowedDatabaseNames.has(databaseName)
  ) {
    throw new Error(
      "Smoke tests require a local matriva_dev or matriva_test PostgreSQL database."
    );
  }
}

export async function cleanupSmokeUsers(databaseUrl, emails) {
  assertSafeSmokeDatabase(databaseUrl);
  const normalizedEmails = [...new Set(emails.map((email) => email.toLowerCase()))];

  if (normalizedEmails.length === 0) {
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "delete from auth_email_rate_limits where normalized_email = any($1::text[])",
      [normalizedEmails]
    );
    await client.query("delete from users where email = any($1::text[])", [
      normalizedEmails
    ]);

    const remaining = await client.query(
      "select count(*)::int as count from users where email = any($1::text[])",
      [normalizedEmails]
    );

    if ((remaining.rows[0]?.count ?? 0) !== 0) {
      throw new Error("Smoke fixture cleanup did not remove every scoped user.");
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
