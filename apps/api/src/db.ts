import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  devUserSchema,
  maintenanceTaskSchema,
  savedHouseSchema
} from "@matriva/shared";
import type {
  CreateMaintenanceTaskRequest,
  DevUser,
  MaintenanceTask,
  MaintenanceTaskStatus,
  MaintenanceTaskTiming,
  RecommendedMaintenanceTaskMetadata,
  SavedHouse,
  SelectedAddressInput
} from "@matriva/shared";

const { Pool } = pg;

const devUserEmail = "rene@joinit.dk";
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

type DevUserRow = {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
};

type HouseRow = {
  id: string;
  dev_user_id: string;
  address_label: string;
  dawa_address_id: string | null;
  source_access_address_id: string | null;
  status: SavedHouse["status"];
  data_confidence: SavedHouse["dataConfidence"];
  created_at: Date;
  updated_at: Date;
};

type MaintenanceTaskRow = {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  source: MaintenanceTask["source"];
  status: MaintenanceTaskStatus;
  timing_type: MaintenanceTaskTiming["type"];
  due_date: string | Date | null;
  season: MaintenanceTaskTiming["season"] | null;
  recommendation: RecommendedMaintenanceTaskMetadata | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function databaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required for Matriva API persistence.");
  }

  return url;
}

const pool = new Pool({
  connectionString: databaseUrl()
});

function createOpaqueId(prefix: "usr" | "house" | "task") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function isoDate(value: Date) {
  return value.toISOString();
}

function dateOnly(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function daysBetweenDateOnly(dateOnlyValue: string, now = new Date()) {
  const dueUtc = Date.parse(`${dateOnlyValue}T00:00:00.000Z`);
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  return Math.round((dueUtc - todayUtc) / 86_400_000);
}

function addDerivedTiming(
  timing: MaintenanceTaskTiming,
  status: MaintenanceTaskStatus
): MaintenanceTaskTiming {
  if (timing.type !== "specific_deadline" || !timing.dueDate) {
    return timing;
  }

  const days = daysBetweenDateOnly(timing.dueDate);

  if (days < 0 && status === "overdue") {
    return {
      ...timing,
      daysOverdue: Math.abs(days)
    };
  }

  if (days >= 0) {
    return {
      ...timing,
      daysUntilDue: days
    };
  }

  return timing;
}

function toDevUser(row: DevUserRow): DevUser {
  return devUserSchema.parse({
    id: row.id,
    email: row.email,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at)
  });
}

function toSavedHouse(row: HouseRow): SavedHouse {
  return savedHouseSchema.parse({
    id: row.id,
    ownerUserId: row.dev_user_id,
    addressLabel: row.address_label,
    ...(row.dawa_address_id ? { dawaAddressId: row.dawa_address_id } : {}),
    status: row.status,
    dataConfidence: row.data_confidence,
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at)
  });
}

function toMaintenanceTask(row: MaintenanceTaskRow): MaintenanceTask {
  const timing = addDerivedTiming(
    {
      type: row.timing_type,
      ...(row.due_date ? { dueDate: dateOnly(row.due_date) } : {}),
      ...(row.season ? { season: row.season } : {})
    },
    row.status
  );

  return maintenanceTaskSchema.parse({
    id: row.id,
    houseId: row.house_id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    source: row.source,
    status: row.status,
    timing,
    ...(row.recommendation ? { recommendation: row.recommendation } : {}),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
    ...(row.completed_at ? { completedAt: isoDate(row.completed_at) } : {})
  });
}

export async function migrateDatabase() {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const migrationName = "0001_persistence_v1.sql";
    const applied = await client.query(
      "select 1 from schema_migrations where name = $1",
      [migrationName]
    );

    if (applied.rowCount === 0) {
      const sql = await readFile(
        join(migrationsDirectory, migrationName),
        "utf8"
      );
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [
        migrationName
      ]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}

export async function ensureCurrentDevUser() {
  const existing = await pool.query<DevUserRow>(
    "select * from dev_users where email = $1",
    [devUserEmail]
  );

  if (existing.rows[0]) {
    return toDevUser(existing.rows[0]);
  }

  const inserted = await pool.query<DevUserRow>(
    `
      insert into dev_users (id, email)
      values ($1, $2)
      on conflict (email) do update set updated_at = dev_users.updated_at
      returning *
    `,
    [createOpaqueId("usr"), devUserEmail]
  );

  return toDevUser(inserted.rows[0] as DevUserRow);
}

export async function createSavedHouse(input: SelectedAddressInput) {
  const devUser = await ensureCurrentDevUser();
  const result = await pool.query<HouseRow>(
    `
      insert into houses (
        id,
        dev_user_id,
        address_label,
        dawa_address_id,
        source_access_address_id
      )
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [
      createOpaqueId("house"),
      devUser.id,
      input.label,
      input.sourceAddressId,
      input.sourceAccessAddressId ?? null
    ]
  );

  return toSavedHouse(result.rows[0] as HouseRow);
}

export async function listSavedHouses() {
  const devUser = await ensureCurrentDevUser();
  const result = await pool.query<HouseRow>(
    "select * from houses where dev_user_id = $1 order by created_at desc",
    [devUser.id]
  );

  return result.rows.map(toSavedHouse);
}

export async function getSavedHouse(houseId: string) {
  const devUser = await ensureCurrentDevUser();
  const result = await pool.query<HouseRow>(
    "select * from houses where id = $1 and dev_user_id = $2",
    [houseId, devUser.id]
  );

  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "house_not_found", "Saved house was not found.");
  }

  return toSavedHouse(row);
}

export async function createMaintenanceTaskForHouse(
  houseId: string,
  input: CreateMaintenanceTaskRequest
) {
  const house = await getSavedHouse(houseId);
  const status = input.status ?? "planned";
  const completedAt = status === "done" ? new Date() : null;
  const result = await pool.query<MaintenanceTaskRow>(
    `
      insert into maintenance_tasks (
        id,
        house_id,
        title,
        description,
        source,
        status,
        timing_type,
        due_date,
        season,
        recommendation,
        completed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10::jsonb, $11)
      returning *
    `,
    [
      createOpaqueId("task"),
      house.id,
      input.title,
      input.description ?? null,
      input.source ?? "user_created",
      status,
      input.timing.type,
      input.timing.dueDate ?? null,
      input.timing.season ?? null,
      input.recommendation ? JSON.stringify(input.recommendation) : null,
      completedAt
    ]
  );

  return toMaintenanceTask(result.rows[0] as MaintenanceTaskRow);
}

export async function listMaintenanceTasksForHouse(houseId: string) {
  const house = await getSavedHouse(houseId);
  const result = await pool.query<MaintenanceTaskRow>(
    `
      select *
      from maintenance_tasks
      where house_id = $1
      order by created_at desc
    `,
    [house.id]
  );

  return result.rows.map(toMaintenanceTask);
}

export async function updateMaintenanceTaskStatus(
  houseId: string,
  taskId: string,
  status: MaintenanceTaskStatus
) {
  const house = await getSavedHouse(houseId);
  const result = await pool.query<MaintenanceTaskRow>(
    `
      update maintenance_tasks
      set
        status = $3,
        completed_at = case
          when $3 = 'done' and completed_at is null then now()
          when $3 <> 'done' then null
          else completed_at
        end,
        updated_at = now()
      where id = $1 and house_id = $2
      returning *
    `,
    [taskId, house.id, status]
  );

  const row = result.rows[0];

  if (!row) {
    throw new ApiError(
      404,
      "maintenance_task_not_found",
      "Maintenance task was not found for this saved house."
    );
  }

  return toMaintenanceTask(row);
}
