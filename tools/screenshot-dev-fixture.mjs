import pg from "pg";

import { assertSafeSmokeDatabase } from "./smoke-database.mjs";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const mode = process.env.MATRIVA_SCREENSHOT_FIXTURE_MODE ?? "setup";
const isAllowed = process.env.MATRIVA_ALLOW_SCREENSHOT_FIXTURES === "true";

const fixtureEmail = "screenshot-test@matriva.local";
const fixtureDisplayName = "Matriva Demo";
const fixtureAddress = "Ringstedgade 130, 4700 Næstved";
const fixtureUserId = "usr_screenshottest2026";
const fixtureProfileId = "profile_screenshottest2026";
const fixtureHouseId = "house_screenshottest2026";
const fixtureSnapshotId = "pubsnap_screenshottest2026";

if (!isAllowed) {
  throw new Error(
    "Set MATRIVA_ALLOW_SCREENSHOT_FIXTURES=true to manage screenshot fixtures.",
  );
}

if (!["setup", "cleanup"].includes(mode)) {
  throw new Error("MATRIVA_SCREENSHOT_FIXTURE_MODE must be setup or cleanup.");
}

assertSafeSmokeDatabase(databaseUrl);

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = parsedDatabaseUrl.pathname.replace(/^\//, "");

if (
  parsedDatabaseUrl.hostname !== "127.0.0.1" &&
  parsedDatabaseUrl.hostname !== "localhost" &&
  parsedDatabaseUrl.hostname !== "::1"
) {
  throw new Error("Screenshot fixtures require a loopback database host.");
}

if (databaseName !== "matriva_dev") {
  throw new Error("Screenshot fixtures may only run against matriva_dev.");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();

function fixtureId(prefix, index) {
  return `${prefix}_screenshottest${String(index).padStart(2, "0")}`;
}

async function insertRecord(table, record) {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  await client.query(
    `insert into ${table} (${columns.join(", ")}) values (${placeholders.join(", ")})`,
    values,
  );
}

async function clonePublicData(sourceSnapshot, sourceHouse) {
  await insertRecord("house_public_data_snapshots", {
    ...sourceSnapshot,
    id: fixtureSnapshotId,
    house_id: fixtureHouseId,
    house_draft_id: null,
    is_current: true,
    fetched_at: new Date(),
    created_at: new Date(),
  });

  const buildings = await client.query(
    `
      select *
      from house_public_buildings
      where snapshot_id = $1
      order by building_number nulls last, id
    `,
    [sourceSnapshot.id],
  );
  const buildingIds = new Map();

  for (const [index, building] of buildings.rows.entries()) {
    const id = fixtureId("pubbld", index + 1);
    buildingIds.set(building.id, id);
    await insertRecord("house_public_buildings", {
      ...building,
      id,
      snapshot_id: fixtureSnapshotId,
      house_id: fixtureHouseId,
      created_at: new Date(),
    });
  }

  const units = await client.query(
    `
      select *
      from house_public_units
      where snapshot_id = $1
      order by id
    `,
    [sourceSnapshot.id],
  );

  for (const [index, unit] of units.rows.entries()) {
    await insertRecord("house_public_units", {
      ...unit,
      id: fixtureId("pubunt", index + 1),
      snapshot_id: fixtureSnapshotId,
      building_id: buildingIds.get(unit.building_id),
      created_at: new Date(),
    });
  }

  const floors = await client.query(
    `
      select *
      from house_public_floors
      where snapshot_id = $1
      order by id
    `,
    [sourceSnapshot.id],
  );

  for (const [index, floor] of floors.rows.entries()) {
    await insertRecord("house_public_floors", {
      ...floor,
      id: fixtureId("pubflr", index + 1),
      snapshot_id: fixtureSnapshotId,
      building_id: buildingIds.get(floor.building_id),
      created_at: new Date(),
    });
  }

  const parcels = await client.query(
    `
      select *
      from house_public_parcels
      where snapshot_id = $1
      order by id
    `,
    [sourceSnapshot.id],
  );

  for (const [index, parcel] of parcels.rows.entries()) {
    await insertRecord("house_public_parcels", {
      ...parcel,
      id: fixtureId("pubpar", index + 1),
      snapshot_id: fixtureSnapshotId,
      created_at: new Date(),
    });
  }

  await client.query(
    `
      update houses
      set
        dawa_address_id = $1,
        source_access_address_id = $2,
        updated_at = now()
      where id = $3
    `,
    [
      sourceHouse.dawa_address_id,
      sourceHouse.source_access_address_id,
      fixtureHouseId,
    ],
  );
}

async function createActiveTask({
  id,
  title,
  description,
  dueDate,
  recurrenceInterval = null,
}) {
  await insertRecord("maintenance_tasks", {
    id,
    house_id: fixtureHouseId,
    user_id: fixtureUserId,
    title,
    description,
    source: "user_created",
    status: "planned",
    timing_type: "specific_deadline",
    due_date: dueDate,
    season: null,
    recommendation: null,
    completed_at: null,
    recurrence_interval: recurrenceInterval,
    recurrence_anchor: recurrenceInterval ? "completed_date" : null,
    archived_at: null,
    deleted_at: null,
    price_amount_minor: null,
    price_currency: "DKK",
    created_at: new Date(),
    updated_at: new Date(),
  });
}

async function createHistoryEntry({
  index,
  title,
  note,
  completedDate,
  priceAmountMinor = null,
}) {
  const taskId = fixtureId("task", index + 10);

  await insertRecord("maintenance_tasks", {
    id: taskId,
    house_id: fixtureHouseId,
    user_id: fixtureUserId,
    title,
    description: note,
    source: "user_created",
    status: "done",
    timing_type: "specific_deadline",
    due_date: completedDate,
    season: null,
    recommendation: null,
    completed_at: `${completedDate}T12:00:00.000Z`,
    recurrence_interval: null,
    recurrence_anchor: null,
    archived_at: null,
    deleted_at: null,
    price_amount_minor: priceAmountMinor,
    price_currency: "DKK",
    created_at: `${completedDate}T12:00:00.000Z`,
    updated_at: `${completedDate}T12:00:00.000Z`,
  });

  await insertRecord("maintenance_completions", {
    id: fixtureId("mcomp", index),
    task_id: taskId,
    house_id: fixtureHouseId,
    user_id: fixtureUserId,
    title_snapshot: title,
    note,
    completed_date: completedDate,
    source: "user_created",
    recurrence_interval: null,
    recurrence_anchor: null,
    price_amount_minor: priceAmountMinor,
    price_currency: "DKK",
    created_at: `${completedDate}T12:00:00.000Z`,
  });
}

async function setupFixture() {
  const sourceResult = await client.query(
    `
      select
        h.id,
        h.dawa_address_id,
        h.source_access_address_id,
        s.*
      from houses h
      join house_public_data_snapshots s
        on s.house_id = h.id and s.is_current
      where h.address_label = $1
        and h.user_id <> $2
        and s.status in ('success', 'partial', 'ambiguous')
      order by
        case s.status when 'success' then 1 when 'partial' then 2 else 3 end,
        s.fetched_at desc
      limit 1
    `,
    [fixtureAddress, fixtureUserId],
  );
  const source = sourceResult.rows[0];

  if (!source) {
    throw new Error(
      "No existing local BBR snapshot was found for the screenshot address.",
    );
  }

  const { dawa_address_id, source_access_address_id, ...sourceSnapshot } =
    source;

  await client.query(
    `
      insert into users (
        id,
        email,
        email_verified_at,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, now(), 'active', now(), now())
      on conflict (email) do update
      set
        status = 'active',
        email_verified_at = coalesce(users.email_verified_at, now()),
        updated_at = now()
    `,
    [fixtureUserId, fixtureEmail],
  );

  const userResult = await client.query(
    "select id from users where email = $1",
    [fixtureEmail],
  );
  const userId = userResult.rows[0]?.id;

  if (userId !== fixtureUserId) {
    throw new Error(
      "The screenshot email already belongs to an unexpected user id.",
    );
  }

  await client.query(
    `
      insert into user_profiles (
        id,
        user_id,
        display_name,
        preferred_locale,
        created_at,
        updated_at
      )
      values ($1, $2, $3, 'da-DK', now(), now())
      on conflict (user_id) do update
      set
        display_name = excluded.display_name,
        preferred_locale = excluded.preferred_locale,
        updated_at = now()
    `,
    [fixtureProfileId, fixtureUserId, fixtureDisplayName],
  );

  await client.query("delete from houses where user_id = $1", [fixtureUserId]);

  await insertRecord("houses", {
    id: fixtureHouseId,
    dev_user_id: null,
    address_label: fixtureAddress,
    dawa_address_id,
    source_access_address_id,
    status: "saved",
    data_confidence: "not_verified",
    user_id: fixtureUserId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await clonePublicData(sourceSnapshot, {
    dawa_address_id,
    source_access_address_id,
  });

  await createActiveTask({
    id: fixtureId("task", 1),
    title: "Rens tagrender",
    description:
      "Fjern blade og kontrollér, at vandet løber frit til nedløbsrørene.",
    dueDate: "2026-09-30",
    recurrenceInterval: "yearly",
  });
  await createActiveTask({
    id: fixtureId("task", 2),
    title: "Service på varmepumpe",
    description: "Book det årlige serviceeftersyn inden fyringssæsonen.",
    dueDate: "2026-10-15",
    recurrenceInterval: "yearly",
  });

  await createHistoryEntry({
    index: 1,
    title: "Rensning af tagrender",
    note: "Tagrender og nedløb renset og kontrolleret.",
    completedDate: "2026-05-12",
  });
  await createHistoryEntry({
    index: 2,
    title: "Service på varmeanlæg",
    note: "Årligt serviceeftersyn gennemført.",
    completedDate: "2026-02-18",
    priceAmountMinor: 145000,
  });
  await createHistoryEntry({
    index: 3,
    title: "Udskiftning af filter",
    note: "Filter udskiftet og næste kontrol noteret.",
    completedDate: "2025-11-04",
    priceAmountMinor: 24900,
  });
  await createHistoryEntry({
    index: 4,
    title: "Kontrol af røgalarmer",
    note: "Røgalarmer testet og batterier kontrolleret.",
    completedDate: "2025-08-20",
  });

  const visibleCatalogKeys = ["facade_visual_check", "visible_moisture_check"];
  const hiddenCatalog = await client.query(
    `
      select catalog_key
      from maintenance_catalog_items
      where is_active
        and catalog_key <> all($1::text[])
      order by catalog_key
    `,
    [visibleCatalogKeys],
  );

  for (const [index, item] of hiddenCatalog.rows.entries()) {
    await insertRecord("maintenance_recommendation_hides", {
      id: fixtureId("mhide", index + 1),
      house_id: fixtureHouseId,
      catalog_key: item.catalog_key,
      hidden_at: new Date(),
      unhidden_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  console.log("Screenshot fixture ready in local matriva_dev.");
  console.log(`Fixture identity: ${fixtureEmail}`);
  console.log(`Fixture address: ${fixtureAddress}`);
}

async function cleanupFixture() {
  await client.query(
    "delete from auth_email_rate_limits where normalized_email = $1",
    [fixtureEmail],
  );
  await client.query("delete from users where email = $1", [fixtureEmail]);
  console.log("Screenshot fixture removed from local matriva_dev.");
}

try {
  await client.query("begin");

  if (mode === "cleanup") {
    await cleanupFixture();
  } else {
    await setupFixture();
  }

  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
