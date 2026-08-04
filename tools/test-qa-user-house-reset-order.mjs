import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.MATRIVA_QA_RESET_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Set MATRIVA_QA_RESET_TEST_DATABASE_URL to an explicitly approved non-QA test database."
  );
}

const database = new URL(databaseUrl);
const databaseName = decodeURIComponent(database.pathname.slice(1)).toLowerCase();
if (/(^|[._-])(prod|production|qa|live|primary)([._-]|$)/.test(database.hostname.toLowerCase()) ||
    /(^|[._-])(prod|production|qa|live|primary)([._-]|$)/.test(databaseName)) {
  throw new Error("Refusing regression test: test database looks like QA or production.");
}

const resetSource = await readFile(new URL("./reset-qa-user-house-data.mjs", import.meta.url), "utf8");
const deleteStepsSource = resetSource.slice(resetSource.indexOf("const DELETE_STEPS"));
const recommendationsIndex = deleteStepsSource.indexOf('"maintenance_recommendations"');
const tasksIndex = deleteStepsSource.indexOf('"maintenance_tasks"');
assert(recommendationsIndex >= 0 && tasksIndex >= 0);
assert(recommendationsIndex < tasksIndex, "Recommendations must be deleted before tasks.");

const id = (prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const fixture = {
  user: id("usr"),
  house: id("house"),
  task: id("task"),
  recommendation: id("mrec"),
  completion: id("mcomp"),
  hide: id("mhide")
};

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("begin");
  await client.query(
    "insert into users (id, email) values ($1, $2)",
    [fixture.user, `${fixture.user}@example.test`]
  );
  await client.query(
    "insert into houses (id, user_id, address_label) values ($1, $2, 'QA reset order test')",
    [fixture.house, fixture.user]
  );
  await client.query(
    `insert into maintenance_tasks
      (id, house_id, user_id, title, source, status, timing_type, completed_at)
     values ($1, $2, $3, 'QA reset order task', 'user_created', 'planned', 'none', null)`,
    [fixture.task, fixture.house, fixture.user]
  );
  await client.query(
    `insert into maintenance_recommendations
      (id, house_id, user_id, source_type, status, title, description,
       recommended_timing_label, timing_type, recommendation_key, version_key,
       accepted_task_id)
     values ($1, $2, $3, 'matriva_catalog', 'accepted', 'QA reset order recommendation',
       'Regression fixture', 'Når det passer', 'none', $4, $5, $6)`,
    [fixture.recommendation, fixture.house, fixture.user, id("catalog"), id("version"), fixture.task]
  );
  await client.query(
    `insert into maintenance_completions
      (id, task_id, house_id, user_id, title_snapshot, completed_date, source)
     values ($1, $2, $3, $4, 'QA reset order task', current_date, 'user_created')`,
    [fixture.completion, fixture.task, fixture.house, fixture.user]
  );
  await client.query(
    "insert into maintenance_recommendation_hides (id, house_id, catalog_key) values ($1, $2, $3)",
    [fixture.hide, fixture.house, id("hide")]
  );

  await client.query("delete from maintenance_recommendation_hides where id = $1", [fixture.hide]);
  await client.query("delete from maintenance_completions where id = $1", [fixture.completion]);
  await client.query("delete from maintenance_recommendations where id = $1", [fixture.recommendation]);
  await client.query("delete from maintenance_tasks where id = $1", [fixture.task]);

  const remaining = await client.query(
    `select count(*)::int as count from maintenance_tasks where id = $1
     union all select count(*)::int from maintenance_recommendations where id = $2
     union all select count(*)::int from maintenance_completions where id = $3
     union all select count(*)::int from maintenance_recommendation_hides where id = $4`,
    [fixture.task, fixture.recommendation, fixture.completion, fixture.hide]
  );
  assert.equal(remaining.rows.reduce((sum, row) => sum + row.count, 0), 0);
  await client.query("rollback");
  console.log(JSON.stringify({ event: "matriva.qa_reset_order_regression_passed" }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
