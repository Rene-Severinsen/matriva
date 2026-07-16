import { createHash, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  appBootstrapResponseSchema,
  currentUserSchema,
  maintenanceTaskSchema,
  savedHouseSchema,
  sessionTokensSchema,
  userProfileSchema
} from "@matriva/shared";
import type {
  AppBootstrapResponse,
  CreateMaintenanceTaskRequest,
  CurrentUser,
  MaintenanceTask,
  MaintenanceTaskStatus,
  MaintenanceTaskTiming,
  RecommendedMaintenanceTaskMetadata,
  SavedHouse,
  SelectedAddressInput,
  SessionTokens,
  UpdateProfileRequest,
  UserProfile
} from "@matriva/shared";

const { Pool } = pg;

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations"
);

const magicLinkTtlMs = 1000 * 60 * 15;
const accessTokenTtlMs = 1000 * 60 * 15;
const refreshTokenTtlMs = 1000 * 60 * 60 * 24 * 30;
const magicLinkCooldownSeconds = 5;
const magicLinkWindowMs = 1000 * 60 * 60;
const magicLinkWindowLimit = 6;

export function authLimitsDisabled() {
  return process.env.MATRIVA_AUTH_DISABLE_LIMITS === "true";
}

export function validateAuthRuntimeConfig() {
  if (process.env.NODE_ENV === "production" && authLimitsDisabled()) {
    throw new Error(
      "MATRIVA_AUTH_DISABLE_LIMITS=true is only allowed outside production."
    );
  }
}

export const authPublicResponse = {
  ok: true as const,
  message: "Hvis emailen kan bruges til Matriva, sender vi et loginlink.",
  cooldownSeconds: magicLinkCooldownSeconds
};

type UserRow = {
  id: string;
  email: string;
  email_verified_at: Date | null;
  status: CurrentUser["status"];
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

type UserProfileRow = {
  display_name: string | null;
  preferred_locale: "da-DK";
};

type HouseRow = {
  id: string;
  user_id: string;
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
  due_date: string | null;
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

function createOpaqueId(prefix: "usr" | "profile" | "house" | "task" | "mlt" | "sess") {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isoDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function futureDate(ms: number) {
  return new Date(Date.now() + ms);
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
    return { ...timing, daysOverdue: Math.abs(days) };
  }

  if (days >= 0) {
    return { ...timing, daysUntilDue: days };
  }

  return timing;
}

function toCurrentUser(row: UserRow): CurrentUser {
  return currentUserSchema.parse({
    id: row.id,
    email: row.email,
    emailVerifiedAt: isoDate(row.email_verified_at),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: isoDate(row.last_login_at)
  });
}

function toProfile(row: UserProfileRow | undefined): UserProfile {
  return userProfileSchema.parse({
    displayName: row?.display_name ?? null,
    preferredLocale: row?.preferred_locale ?? "da-DK"
  });
}

function toSavedHouse(row: HouseRow): SavedHouse {
  return savedHouseSchema.parse({
    id: row.id,
    ownerUserId: row.user_id,
    addressLabel: row.address_label,
    ...(row.dawa_address_id ? { dawaAddressId: row.dawa_address_id } : {}),
    status: row.status,
    dataConfidence: row.data_confidence,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function toMaintenanceTask(row: MaintenanceTaskRow): MaintenanceTask {
  const timing = addDerivedTiming(
    {
      type: row.timing_type,
      ...(row.due_date ? { dueDate: row.due_date } : {}),
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
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.completed_at ? { completedAt: row.completed_at.toISOString() } : {})
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

    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const migrationName of migrationNames) {
      const applied = await client.query(
        "select 1 from schema_migrations where name = $1",
        [migrationName]
      );

      if (applied.rowCount === 0) {
        const sql = await readFile(join(migrationsDirectory, migrationName), "utf8");
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [
          migrationName
        ]);
      }
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

export async function ensureUserForEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const result = await pool.query<UserRow>(
    `
      insert into users (id, email)
      values ($1, $2)
      on conflict (email) do update set updated_at = users.updated_at
      returning *
    `,
    [createOpaqueId("usr"), normalizedEmail]
  );
  const user = toCurrentUser(result.rows[0] as UserRow);

  await pool.query(
    `
      insert into user_profiles (id, user_id)
      values ($1, $2)
      on conflict (user_id) do nothing
    `,
    [createOpaqueId("profile"), user.id]
  );

  return user;
}

export async function checkMagicLinkCooldown(email: string) {
  if (authLimitsDisabled()) {
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const now = new Date();
  const existing = await pool.query<{
    last_requested_at: Date;
    request_count: number;
    window_started_at: Date;
  }>("select * from auth_email_rate_limits where normalized_email = $1", [
    normalizedEmail
  ]);
  const row = existing.rows[0];

  if (!row) {
    await pool.query(
      `insert into auth_email_rate_limits (normalized_email, last_requested_at) values ($1, now())`,
      [normalizedEmail]
    );
    return;
  }

  const lastRequestedAge = now.getTime() - row.last_requested_at.getTime();
  const windowAge = now.getTime() - row.window_started_at.getTime();

  if (lastRequestedAge < magicLinkCooldownSeconds * 1000) {
    throw new ApiError(429, "magic_link_rate_limited", authPublicResponse.message);
  }

  if (windowAge < magicLinkWindowMs && row.request_count >= magicLinkWindowLimit) {
    throw new ApiError(429, "magic_link_rate_limited", authPublicResponse.message);
  }

  await pool.query(
    `
      update auth_email_rate_limits
      set
        last_requested_at = now(),
        request_count = case
          when now() - window_started_at > interval '1 hour' then 1
          else request_count + 1
        end,
        window_started_at = case
          when now() - window_started_at > interval '1 hour' then now()
          else window_started_at
        end
      where normalized_email = $1
    `,
    [normalizedEmail]
  );
}

export async function createMagicLinkToken(email: string, metadata: { ipHash?: string; userAgentHint?: string }) {
  await checkMagicLinkCooldown(email);
  const user = await ensureUserForEmail(email);
  const token = createToken();
  const expiresAt = futureDate(magicLinkTtlMs);

  await pool.query(
    `
      insert into magic_link_tokens (
        id, user_id, token_hash, expires_at, requested_ip_hash, user_agent_hint
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      createOpaqueId("mlt"),
      user.id,
      hashSecret(token),
      expiresAt,
      metadata.ipHash ?? null,
      metadata.userAgentHint?.slice(0, 160) ?? null
    ]
  );

  return { token, expiresAt, user };
}

async function createSessionForUser(userId: string): Promise<SessionTokens> {
  const accessToken = createToken();
  const refreshToken = createToken();
  const accessTokenExpiresAt = futureDate(accessTokenTtlMs);
  const refreshTokenExpiresAt = futureDate(refreshTokenTtlMs);

  await pool.query(
    `
      insert into auth_sessions (
        id,
        user_id,
        access_token_hash,
        access_token_expires_at,
        refresh_token_hash,
        refresh_token_expires_at
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      createOpaqueId("sess"),
      userId,
      hashSecret(accessToken),
      accessTokenExpiresAt,
      hashSecret(refreshToken),
      refreshTokenExpiresAt
    ]
  );

  return sessionTokensSchema.parse({
    accessToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString()
  });
}

export async function consumeMagicLinkToken(token: string) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await client.query<{ id: string; user_id: string; expires_at: Date; consumed_at: Date | null }>(
      `
        select id, user_id, expires_at, consumed_at
        from magic_link_tokens
        where token_hash = $1
        for update
      `,
      [hashSecret(token)]
    );
    const row = result.rows[0];

    if (!row) {
      throw new ApiError(401, "magic_link_invalid", "Loginlinket er ugyldigt eller udløbet.");
    }

    if (row.consumed_at) {
      throw new ApiError(401, "magic_link_consumed", "Loginlinket er allerede brugt.");
    }

    if (row.expires_at.getTime() <= Date.now()) {
      throw new ApiError(401, "magic_link_expired", "Loginlinket er udløbet.");
    }

    await client.query(
      "update magic_link_tokens set consumed_at = now() where id = $1",
      [row.id]
    );
    await client.query(
      `update users set email_verified_at = coalesce(email_verified_at, now()), last_login_at = now(), updated_at = now() where id = $1`,
      [row.user_id]
    );
    await client.query("commit");

    const [user, profile, tokens] = await Promise.all([
      getUserById(row.user_id),
      getProfileForUser(row.user_id),
      createSessionForUser(row.user_id)
    ]);

    return { user, profile, tokens };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserById(userId: string) {
  const result = await pool.query<UserRow>("select * from users where id = $1", [userId]);
  const row = result.rows[0];

  if (!row || row.status !== "active") {
    throw new ApiError(401, "auth_required", "Authentication is required.");
  }

  return toCurrentUser(row);
}

export async function getProfileForUser(userId: string) {
  const result = await pool.query<UserProfileRow>(
    "select display_name, preferred_locale from user_profiles where user_id = $1",
    [userId]
  );

  return toProfile(result.rows[0]);
}

export async function authenticateAccessToken(accessToken: string | undefined) {
  if (!accessToken) {
    throw new ApiError(401, "auth_required", "Authentication is required.");
  }

  const result = await pool.query<{ user_id: string }>(
    `
      update auth_sessions
      set last_used_at = now(), updated_at = now()
      where access_token_hash = $1
        and revoked_at is null
        and access_token_expires_at > now()
      returning user_id
    `,
    [hashSecret(accessToken)]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(401, "auth_required", "Authentication is required.");
  }

  return row.user_id;
}

export async function refreshSession(refreshToken: string) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await client.query<{ id: string; user_id: string }>(
      `
        select id, user_id
        from auth_sessions
        where refresh_token_hash = $1
          and revoked_at is null
          and refresh_token_expires_at > now()
        for update
      `,
      [hashSecret(refreshToken)]
    );
    const row = result.rows[0];

    if (!row) {
      throw new ApiError(401, "session_invalid", "Sessionen er udløbet.");
    }

    const accessToken = createToken();
    const nextRefreshToken = createToken();
    const accessTokenExpiresAt = futureDate(accessTokenTtlMs);
    const refreshTokenExpiresAt = futureDate(refreshTokenTtlMs);

    await client.query(
      `
        update auth_sessions
        set
          access_token_hash = $2,
          access_token_expires_at = $3,
          refresh_token_hash = $4,
          refresh_token_expires_at = $5,
          last_used_at = now(),
          updated_at = now()
        where id = $1
      `,
      [
        row.id,
        hashSecret(accessToken),
        accessTokenExpiresAt,
        hashSecret(nextRefreshToken),
        refreshTokenExpiresAt
      ]
    );
    await client.query("commit");

    const [user, profile] = await Promise.all([
      getUserById(row.user_id),
      getProfileForUser(row.user_id)
    ]);

    return {
      user,
      profile,
      tokens: sessionTokensSchema.parse({
        accessToken,
        accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
        refreshToken: nextRefreshToken,
        refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString()
      })
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function logoutSession(userId: string, refreshToken?: string) {
  if (refreshToken) {
    await pool.query(
      `update auth_sessions set revoked_at = now(), updated_at = now() where user_id = $1 and refresh_token_hash = $2 and revoked_at is null`,
      [userId, hashSecret(refreshToken)]
    );
    return;
  }

  await pool.query(
    `update auth_sessions set revoked_at = now(), updated_at = now() where user_id = $1 and revoked_at is null`,
    [userId]
  );
}

export async function updateProfile(userId: string, input: UpdateProfileRequest) {
  const result = await pool.query<UserProfileRow>(
    `
      update user_profiles
      set display_name = $2, preferred_locale = $3, updated_at = now()
      where user_id = $1
      returning display_name, preferred_locale
    `,
    [userId, input.displayName.trim(), input.preferredLocale ?? "da-DK"]
  );

  return toProfile(result.rows[0]);
}

export async function createSavedHouse(userId: string, input: SelectedAddressInput) {
  const result = await pool.query<HouseRow>(
    `
      insert into houses (
        id,
        user_id,
        dev_user_id,
        address_label,
        dawa_address_id,
        source_access_address_id
      )
      values ($1, $2, null, $3, $4, $5)
      returning *
    `,
    [
      createOpaqueId("house"),
      userId,
      input.label,
      input.sourceAddressId,
      input.sourceAccessAddressId ?? null
    ]
  );

  return toSavedHouse(result.rows[0] as HouseRow);
}

export async function listSavedHouses(userId: string) {
  const result = await pool.query<HouseRow>(
    "select * from houses where user_id = $1 order by created_at desc",
    [userId]
  );

  return result.rows.map(toSavedHouse);
}

export async function getSavedHouse(userId: string, houseId: string) {
  const result = await pool.query<HouseRow>(
    "select * from houses where id = $1 and user_id = $2",
    [houseId, userId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "house_not_found", "Saved house was not found.");
  }

  return toSavedHouse(row);
}

export async function createMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  input: CreateMaintenanceTaskRequest
) {
  const house = await getSavedHouse(userId, houseId);
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
      returning
        id,
        house_id,
        title,
        description,
        source,
        status,
        timing_type,
        to_char(due_date, 'YYYY-MM-DD') as due_date,
        season,
        recommendation,
        created_at,
        updated_at,
        completed_at
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

export async function listMaintenanceTasksForHouse(userId: string, houseId: string) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<MaintenanceTaskRow>(
    `
      select
        id,
        house_id,
        title,
        description,
        source,
        status,
        timing_type,
        to_char(due_date, 'YYYY-MM-DD') as due_date,
        season,
        recommendation,
        created_at,
        updated_at,
        completed_at
      from maintenance_tasks
      where house_id = $1
      order by created_at desc
    `,
    [house.id]
  );

  return result.rows.map(toMaintenanceTask);
}

export async function updateMaintenanceTaskStatus(
  userId: string,
  houseId: string,
  taskId: string,
  status: MaintenanceTaskStatus
) {
  const house = await getSavedHouse(userId, houseId);
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
      returning
        id,
        house_id,
        title,
        description,
        source,
        status,
        timing_type,
        to_char(due_date, 'YYYY-MM-DD') as due_date,
        season,
        recommendation,
        created_at,
        updated_at,
        completed_at
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

export async function buildAppBootstrap(userId: string): Promise<AppBootstrapResponse> {
  const [user, profile, houses] = await Promise.all([
    getUserById(userId),
    getProfileForUser(userId),
    listSavedHouses(userId)
  ]);
  const now = new Date().toISOString();
  const onboardingState = !profile.displayName
    ? "profile_required"
    : houses.length === 0
      ? "house_required"
      : "complete";

  return appBootstrapResponseSchema.parse({
    user,
    profile,
    onboardingState,
    primaryHouse: houses[0] ?? null,
    entitlements: {
      plan: "free",
      status: "free",
      features: {
        "documents.maxCount": { kind: "limit", value: 0 },
        "documents.maxStorageMb": { kind: "limit", value: 0 },
        "tasks.maxActive": { kind: "limit", value: 3 },
        "advisories.enabled": { kind: "boolean", value: false },
        "legalUpdates.enabled": { kind: "boolean", value: false },
        "sharing.enabled": { kind: "boolean", value: false },
        "export.enabled": { kind: "boolean", value: false },
        "advancedReminders.enabled": { kind: "boolean", value: false }
      },
      evaluatedAt: now
    },
    cards: [],
    generatedAt: now
  });
}
