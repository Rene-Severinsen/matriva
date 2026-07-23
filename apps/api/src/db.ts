import { createHash, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  appBootstrapResponseSchema,
  maintenanceHistoryEntrySchema,
  maintenanceHistoryDetailSchema,
  maintenanceRecommendationOriginSnapshotSchema,
  maintenanceRecommendationSchema,
  currentUserSchema,
  houseDocumentSchema,
  houseImprovementSchema,
  houseMediaSchema,
  maintenanceTaskSchema,
  savedHouseSchema,
  sessionTokensSchema,
  userProfileSchema
} from "@matriva/shared";
import type {
  AppBootstrapResponse,
  CreateHouseImprovementRequest,
  CreateMaintenanceTaskRequest,
  AcceptMaintenanceRecommendationRequest,
  CompleteMaintenanceTaskRequest,
  CurrentUser,
  HouseImprovement,
  HouseDocument,
  HouseMedia,
  MaintenanceHistoryEntry,
  MaintenanceHistoryQuery,
  MaintenanceHistoryDetail,
  MaintenanceRecommendation,
  MaintenanceRecommendationDismissMode,
  MaintenanceTask,
  MaintenanceTaskStatus,
  MaintenanceTaskTiming,
  MoveMaintenanceTaskRequest,
  RecommendedMaintenanceTaskMetadata,
  SavedHouse,
  SelectedAddressInput,
  SessionTokens,
  UpdateMaintenanceTaskRequest,
  UpdateProfileRequest,
  UserProfile
} from "@matriva/shared";
import {
  maintenanceCatalogItems,
  recommendedPeriodLabel,
  type MaintenanceCatalogItem,
  type MaintenanceCatalogPeriod
} from "./maintenance-catalog.ts";
import { ensurePermanentSuperAdminRoleForUser } from "./admin.ts";

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
  price_amount_minor: number | null;
  price_currency: "DKK";
  recommendation: RecommendedMaintenanceTaskMetadata | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  recurrence_interval: MaintenanceTask["recurrence"] extends null | undefined ? string | null : string | null;
  recurrence_anchor: string | null;
  component_key: string | null;
  archived_at: Date | null;
  recommendation_id: string | null;
  origin_catalog_key: string | null;
  origin_catalog_version: string | null;
  origin_recommendation_instance_id: string | null;
  origin_snapshot: unknown;
};

type MaintenanceRecommendationRow = {
  id: string;
  house_id: string;
  catalog_key: string | null;
  catalog_version: string | null;
  source_type: MaintenanceRecommendation["sourceType"];
  status: MaintenanceRecommendation["status"];
  title: string;
  description: string;
  recommended_timing_label: string;
  recommended_period: MaintenanceRecommendation["recommendedPeriod"] | null;
  period_key: string | null;
  suggested_due_date: string | null;
  priority: MaintenanceRecommendation["priority"] | null;
  disclaimer_class: MaintenanceRecommendation["disclaimerClass"] | null;
  why: string | null;
  timing_type: MaintenanceTaskTiming["type"];
  due_date: string | null;
  season: MaintenanceTaskTiming["season"] | null;
  recurrence_interval: string | null;
  recurrence_anchor: string | null;
  component_key: string | null;
  provenance: MaintenanceRecommendation["provenance"];
  recommendation_key: string;
  accepted_task_id: string | null;
  dismissed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type MaintenanceCatalogItemRow = {
  id: string;
  catalog_key: string;
  catalog_version: string;
  title: string;
  short_description: string;
  component_key: string;
  season: MaintenanceTaskTiming["season"];
  recommended_period: MaintenanceCatalogPeriod;
  default_recurrence_interval: string;
  priority: MaintenanceRecommendation["priority"];
  eligibility_rules: MaintenanceCatalogItem["eligibilityRules"];
  disclaimer_class: MaintenanceRecommendation["disclaimerClass"];
  is_active: boolean;
};

type MaintenanceCompletionRow = {
  id: string;
  task_id: string;
  house_id: string;
  title_snapshot: string;
  note: string | null;
  completed_date: string;
  price_amount_minor: number | null;
  price_currency: "DKK";
  component_key: string | null;
  source: MaintenanceTask["source"];
  recurrence_interval: string | null;
  recurrence_anchor: string | null;
  created_at: Date;
};

type HouseDocumentRow = {
  id: string;
  house_id: string;
  object_key: string;
  original_filename: string;
  mime_type: HouseDocument["mimeType"];
  size_bytes: number;
  checksum_sha256: string | null;
  upload_status: HouseDocument["uploadStatus"];
  created_at: Date;
  updated_at: Date;
};

type HouseImprovementRow = {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  category: HouseImprovement["category"];
  improvement_date: string | null;
  improvement_year: number | null;
  cost_amount_minor: number | null;
  cost_currency: string | null;
  document_reference: string | null;
  status: HouseImprovement["status"];
  created_at: Date;
  updated_at: Date;
};

type HouseMediaRow = {
  id: string;
  house_id: string;
  media_type: HouseMedia["mediaType"];
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  storage_key: string;
  created_at: Date;
  updated_at: Date;
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

export const pool = new Pool({
  connectionString: databaseUrl()
});

export function createOpaqueId(
  prefix:
    | "usr"
    | "profile"
    | "house"
    | "task"
    | "mlt"
    | "sess"
    | "pubsnap"
    | "pubbld"
    | "pubunt"
    | "pubflr"
    | "pubpar"
    | "impr"
    | "media"
    | "mrec"
    | "mcat"
    | "mhide"
    | "mcomp"
    | "doc"
) {
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

function nullableNumber(value: number | string | null) {
  return value === null ? null : Number(value);
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

function maintenanceTaskReturningColumns() {
  return `
    id,
    house_id,
    title,
    description,
    source,
    status,
    timing_type,
    to_char(due_date, 'YYYY-MM-DD') as due_date,
    season,
    price_amount_minor,
    price_currency,
    recommendation,
    recurrence_interval,
    recurrence_anchor,
    component_key,
    archived_at,
    recommendation_id,
    origin_catalog_key,
    origin_catalog_version,
    origin_recommendation_instance_id,
    origin_snapshot,
    created_at,
    updated_at,
    completed_at
  `;
}

function maintenanceRecommendationReturningColumns() {
  return `
    id,
    house_id,
    catalog_key,
    catalog_version,
    source_type,
    status,
    title,
    description,
    recommended_timing_label,
    recommended_period,
    period_key,
    to_char(suggested_due_date, 'YYYY-MM-DD') as suggested_due_date,
    priority,
    disclaimer_class,
    why,
    timing_type,
    to_char(due_date, 'YYYY-MM-DD') as due_date,
    season,
    recurrence_interval,
    recurrence_anchor,
    component_key,
    provenance,
    recommendation_key,
    accepted_task_id,
    dismissed_at,
    created_at,
    updated_at
  `;
}

function currentDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyFromParts(year: number, month: number, day: number) {
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function periodKeyForCatalogItem(item: Pick<MaintenanceCatalogItemRow, "season">, today = currentDateOnly()) {
  const year = Number(today.slice(0, 4));

  if (item.season === "spring") {
    return `${year}-spring`;
  }

  if (item.season === "autumn") {
    return `${year}-autumn`;
  }

  return `${year}-all-year`;
}

function suggestedDueDateForCatalogItem(
  item: Pick<MaintenanceCatalogItemRow, "season">,
  today = currentDateOnly()
) {
  const year = Number(today.slice(0, 4));

  if (item.season === "spring") {
    const springEnd = dateOnlyFromParts(year, 5, 31);

    if (today > springEnd) {
      return null;
    }

    const springDefault = dateOnlyFromParts(year, 4, 15);
    return today <= springDefault ? springDefault : addDays(today, 7) <= springEnd ? addDays(today, 7) : springEnd;
  }

  if (item.season === "autumn") {
    const autumnEnd = dateOnlyFromParts(year, 11, 30);

    if (today > autumnEnd) {
      return null;
    }

    const autumnDefault = dateOnlyFromParts(year, 10, 15);
    return today <= autumnDefault ? autumnDefault : addDays(today, 7) <= autumnEnd ? addDays(today, 7) : autumnEnd;
  }

  const yearEnd = dateOnlyFromParts(year, 12, 31);
  const suggested = addDays(today, 30);
  return suggested <= yearEnd ? suggested : yearEnd;
}

function evaluateCatalogEligibility(item: MaintenanceCatalogItemRow) {
  if (item.eligibility_rules?.type !== "universal_house") {
    return {
      eligible: false,
      snapshot: {
        type: item.eligibility_rules?.type ?? "unknown",
        eligible: false,
        reason: "Ukendt eligibility-regel blev afvist."
      }
    };
  }

  return {
    eligible: true,
    snapshot: {
      type: "universal_house",
      eligible: true,
      reason: "Generel vedligeholdelsesanbefaling for huset."
    }
  };
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
  const parsedOriginSnapshot =
    row.origin_snapshot === null || row.origin_snapshot === undefined
      ? null
      : maintenanceRecommendationOriginSnapshotSchema.safeParse(row.origin_snapshot);
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
    priceAmountMinor: nullableNumber(row.price_amount_minor),
    priceCurrency: row.price_currency,
    ...(row.recommendation ? { recommendation: row.recommendation } : {}),
    recurrence: row.recurrence_interval
      ? {
          interval: row.recurrence_interval,
          anchor: row.recurrence_anchor ?? "completed_date"
        }
      : null,
    componentKey: row.component_key,
    archivedAt: isoDate(row.archived_at),
    originCatalogKey: row.origin_catalog_key,
    originCatalogVersion: row.origin_catalog_version,
    originRecommendationInstanceId: row.origin_recommendation_instance_id,
    originSnapshot:
      parsedOriginSnapshot && parsedOriginSnapshot.success
        ? parsedOriginSnapshot.data
        : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.completed_at ? { completedAt: row.completed_at.toISOString() } : {})
  });
}

function toMaintenanceRecommendation(
  row: MaintenanceRecommendationRow
): MaintenanceRecommendation {
  return maintenanceRecommendationSchema.parse({
    id: row.id,
    houseId: row.house_id,
    sourceType: row.source_type,
    status: row.status,
    ...(row.catalog_key ? { catalogKey: row.catalog_key } : {}),
    ...(row.catalog_version ? { catalogVersion: row.catalog_version } : {}),
    title: row.title,
    description: row.description,
    recommendedTimingLabel: row.recommended_timing_label,
    ...(row.recommended_period ? { recommendedPeriod: row.recommended_period } : {}),
    ...(row.period_key ? { periodKey: row.period_key } : {}),
    ...(row.suggested_due_date ? { suggestedDueDate: row.suggested_due_date } : {}),
    defaultRecurrence: row.recurrence_interval
      ? {
          interval: row.recurrence_interval,
          anchor: row.recurrence_anchor ?? "completed_date"
        }
      : null,
    ...(row.priority ? { priority: row.priority } : {}),
    ...(row.disclaimer_class ? { disclaimerClass: row.disclaimer_class } : {}),
    ...(row.why ? { why: row.why } : {}),
    timing: {
      type: row.timing_type,
      ...(row.due_date ? { dueDate: row.due_date } : {}),
      ...(row.season ? { season: row.season } : {})
    },
    recurrence: row.recurrence_interval
      ? {
          interval: row.recurrence_interval,
          anchor: row.recurrence_anchor ?? "completed_date"
        }
      : null,
    componentKey: row.component_key,
    provenance: row.provenance,
    recommendationKey: row.recommendation_key,
    acceptedTaskId: row.accepted_task_id,
    dismissedAt: isoDate(row.dismissed_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function toMaintenanceHistoryEntry(
  row: MaintenanceCompletionRow
): MaintenanceHistoryEntry {
  return maintenanceHistoryEntrySchema.parse({
    id: row.id,
    taskId: row.task_id,
    houseId: row.house_id,
    title: row.title_snapshot,
    completedDate: row.completed_date,
    note: row.note,
    priceAmountMinor: nullableNumber(row.price_amount_minor),
    priceCurrency: row.price_currency,
    componentKey: row.component_key,
    source: row.source,
    recurrence: row.recurrence_interval
      ? {
          interval: row.recurrence_interval,
          anchor: row.recurrence_anchor ?? "completed_date"
        }
      : null,
    createdAt: row.created_at.toISOString()
  });
}

function houseDocumentContentPath(houseId: string, documentId: string) {
  return `/v1/houses/${houseId}/documents/${documentId}/content`;
}

function toHouseDocument(row: HouseDocumentRow): HouseDocument {
  return houseDocumentSchema.parse({
    id: row.id,
    houseId: row.house_id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadStatus: row.upload_status,
    contentPath:
      row.upload_status === "uploaded"
        ? houseDocumentContentPath(row.house_id, row.id)
        : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function housePhotoContentPath(houseId: string) {
  return `/v1/houses/${houseId}/photo/content`;
}

function toHouseImprovement(row: HouseImprovementRow): HouseImprovement {
  return houseImprovementSchema.parse({
    id: row.id,
    houseId: row.house_id,
    title: row.title,
    description: row.description,
    category: row.category,
    improvementDate: row.improvement_date,
    improvementYear: row.improvement_year,
    costAmountMinor: row.cost_amount_minor,
    costCurrency: row.cost_currency,
    documentReference: row.document_reference,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function toHouseMedia(row: HouseMediaRow): HouseMedia {
  return houseMediaSchema.parse({
    id: row.id,
    houseId: row.house_id,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    storageKey: row.storage_key,
    contentPath: housePhotoContentPath(row.house_id),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
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

  await ensurePermanentSuperAdminRoleForUser(user.id, user.email);

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
        user_id,
        title,
        description,
        source,
        status,
        timing_type,
        due_date,
        season,
        price_amount_minor,
        price_currency,
        recommendation,
        recurrence_interval,
        recurrence_anchor,
        component_key,
        completed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13::jsonb, $14, $15, $16, $17)
      returning
        ${maintenanceTaskReturningColumns()}
    `,
    [
      createOpaqueId("task"),
      house.id,
      userId,
      input.title,
      input.description ?? null,
      input.source ?? "user_created",
      status,
      input.timing.type,
      input.timing.dueDate ?? null,
      input.timing.season ?? null,
      input.priceAmountMinor ?? null,
      input.priceCurrency ?? "DKK",
      null,
      input.recurrence?.interval ?? null,
      input.recurrence?.anchor ?? null,
      input.componentKey ?? null,
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
        ${maintenanceTaskReturningColumns()}
      from maintenance_tasks
      where house_id = $1
        and deleted_at is null
        and archived_at is null
        and status not in ('done', 'dismissed')
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
        ${maintenanceTaskReturningColumns()}
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

function nextDateForRecurrence(dateOnly: string, interval: string) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  const monthsByInterval: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
    every_2_years: 24,
    every_3_years: 36,
    every_5_years: 60,
    every_10_years: 120
  };
  date.setUTCMonth(date.getUTCMonth() + (monthsByInterval[interval] ?? 12));
  return date.toISOString().slice(0, 10);
}

export async function getMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  taskId: string
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<MaintenanceTaskRow>(
    `
      select
        ${maintenanceTaskReturningColumns()}
      from maintenance_tasks
      where id = $1 and house_id = $2 and deleted_at is null
    `,
    [taskId, house.id]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "maintenance_task_not_found", "Opgaven blev ikke fundet.");
  }

  return toMaintenanceTask(row);
}

export async function updateMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  taskId: string,
  input: UpdateMaintenanceTaskRequest
) {
  const existing = await getMaintenanceTaskForHouse(userId, houseId, taskId);

  if (existing.source !== "user_created" && existing.source !== "recommendation_accepted") {
    throw new ApiError(403, "maintenance_task_not_editable", "Systemforslag kan ikke redigeres som opgaver.");
  }

  const result = await pool.query<MaintenanceTaskRow>(
    `
      update maintenance_tasks
      set
        title = coalesce($3, title),
        description = case when $4::boolean then $5 else description end,
        status = coalesce($6, status),
        timing_type = coalesce($7, timing_type),
        due_date = case when $7 is null then due_date else $8::date end,
        season = case when $7 is null then season else $9 end,
        recurrence_interval = case when $10::boolean then $11 else recurrence_interval end,
        recurrence_anchor = case when $10::boolean then $12 else recurrence_anchor end,
        component_key = case when $13::boolean then $14 else component_key end,
        price_amount_minor = case when $15::boolean then $16 else price_amount_minor end,
        price_currency = case when $15::boolean then coalesce($17, 'DKK') else price_currency end,
        updated_at = now()
      where id = $1 and house_id = $2 and deleted_at is null and archived_at is null
      returning
        ${maintenanceTaskReturningColumns()}
    `,
    [
      taskId,
      existing.houseId,
      input.title?.trim() ?? null,
      Object.prototype.hasOwnProperty.call(input, "description"),
      input.description?.trim() || null,
      input.status ?? null,
      input.timing?.type ?? null,
      input.timing?.dueDate ?? null,
      input.timing?.season ?? null,
      Object.prototype.hasOwnProperty.call(input, "recurrence"),
      input.recurrence?.interval ?? null,
      input.recurrence?.anchor ?? null,
      Object.prototype.hasOwnProperty.call(input, "componentKey"),
      input.componentKey?.trim() || null,
      Object.prototype.hasOwnProperty.call(input, "priceAmountMinor"),
      input.priceAmountMinor ?? null,
      input.priceCurrency ?? "DKK"
    ]
  );

  return toMaintenanceTask(result.rows[0] as MaintenanceTaskRow);
}

export async function moveMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  taskId: string,
  input: MoveMaintenanceTaskRequest
) {
  return updateMaintenanceTaskForHouse(userId, houseId, taskId, {
    timing: input.timing,
    status: "rescheduled"
  });
}

export async function archiveMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  taskId: string
) {
  const existing = await getMaintenanceTaskForHouse(userId, houseId, taskId);

  if (existing.source !== "user_created" && existing.source !== "recommendation_accepted") {
    throw new ApiError(403, "maintenance_task_not_deletable", "Systemforslag slettes ikke via opgave-CRUD.");
  }

  const result = await pool.query<MaintenanceTaskRow>(
    `
      update maintenance_tasks
      set archived_at = now(), updated_at = now()
      where id = $1 and house_id = $2 and status <> 'done' and archived_at is null
      returning
        ${maintenanceTaskReturningColumns()}
    `,
    [taskId, existing.houseId]
  );

  if (!result.rows[0]) {
    throw new ApiError(409, "maintenance_task_archive_blocked", "Udførte opgaver med historik kan ikke slettes uden særskilt bekræftelse.");
  }

  return toMaintenanceTask(result.rows[0] as MaintenanceTaskRow);
}

async function syncMaintenanceCatalogItems() {
  for (const item of maintenanceCatalogItems) {
    await pool.query(
      `
        insert into maintenance_catalog_items (
          id,
          catalog_key,
          catalog_version,
          title,
          short_description,
          component_key,
          season,
          recommended_period,
          default_recurrence_interval,
          priority,
          eligibility_rules,
          disclaimer_class,
          is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $13)
        on conflict (catalog_key, catalog_version) do update
        set
          title = excluded.title,
          short_description = excluded.short_description,
          component_key = excluded.component_key,
          season = excluded.season,
          recommended_period = excluded.recommended_period,
          default_recurrence_interval = excluded.default_recurrence_interval,
          priority = excluded.priority,
          eligibility_rules = excluded.eligibility_rules,
          disclaimer_class = excluded.disclaimer_class,
          is_active = excluded.is_active,
          updated_at = now()
      `,
      [
        createOpaqueId("mcat"),
        item.catalogKey,
        item.catalogVersion,
        item.title,
        item.shortDescription,
        item.componentKey,
        item.season,
        JSON.stringify(item.recommendedPeriod),
        item.defaultRecurrenceInterval,
        item.priority,
        JSON.stringify(item.eligibilityRules),
        item.disclaimerClass,
        item.isActive
      ]
    );
  }
}

async function ensureMaintenanceRecommendationInstancesForHouse(
  userId: string,
  houseId: string
) {
  await syncMaintenanceCatalogItems();
  const result = await pool.query<MaintenanceCatalogItemRow>(
    `
      select
        id,
        catalog_key,
        catalog_version,
        title,
        short_description,
        component_key,
        season,
        recommended_period,
        default_recurrence_interval,
        priority,
        eligibility_rules,
        disclaimer_class,
        is_active
      from maintenance_catalog_items
      where is_active
      order by catalog_key, catalog_version
    `
  );

  for (const item of result.rows) {
    const eligibility = evaluateCatalogEligibility(item);

    if (!eligibility.eligible) {
      continue;
    }

    const suggestedDueDate = suggestedDueDateForCatalogItem(item);

    if (!suggestedDueDate) {
      continue;
    }

    const periodKey = periodKeyForCatalogItem(item);
    const blockers = await pool.query<{ id: string }>(
      `
        select h.id
        from maintenance_recommendation_hides h
        where h.house_id = $1
          and h.catalog_key = $2
          and h.unhidden_at is null
        union all
        select t.id
        from maintenance_tasks t
        where t.house_id = $1
          and t.user_id = $3
          and t.origin_catalog_key = $2
          and t.deleted_at is null
          and t.archived_at is null
          and t.status <> 'done'
        limit 1
      `,
      [houseId, item.catalog_key, userId]
    );

    if (blockers.rows[0]) {
      continue;
    }

    await pool.query(
      `
        insert into maintenance_recommendations (
          id,
          house_id,
          user_id,
          catalog_item_id,
          catalog_key,
          catalog_version,
          source_type,
          title,
          description,
          recommended_timing_label,
          recommended_period,
          period_key,
          suggested_due_date,
          timing_type,
          due_date,
          season,
          recurrence_interval,
          recurrence_anchor,
          component_key,
          provenance,
          eligibility_snapshot,
          recommendation_key,
          version_key,
          priority,
          disclaimer_class,
          why
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'matriva_catalog',
          $7,
          $8,
          $9,
          $10::jsonb,
          $11,
          $12::date,
          'specific_deadline',
          $12::date,
          null,
          $13,
          'completed_date',
          $14,
          $15::jsonb,
          $16::jsonb,
          $5,
          $17,
          $18,
          $19,
          $20
        )
        on conflict (house_id, catalog_item_id, period_key)
        where catalog_item_id is not null and period_key is not null
        do nothing
      `,
      [
        createOpaqueId("mrec"),
        houseId,
        userId,
        item.id,
        item.catalog_key,
        item.catalog_version,
        item.title,
        item.short_description,
        recommendedPeriodLabel(item.recommended_period),
        JSON.stringify(item.recommended_period),
        periodKey,
        suggestedDueDate,
        item.default_recurrence_interval,
        item.component_key,
        JSON.stringify({
          extractionMethod: "matriva_catalog",
          originalTitle: item.title,
          originalDescription: item.short_description,
          originalTiming: recommendedPeriodLabel(item.recommended_period)
        }),
        JSON.stringify(eligibility.snapshot),
        `${item.catalog_key}:${item.catalog_version}:${periodKey}`,
        item.priority,
        item.disclaimer_class,
        eligibility.snapshot.reason
      ]
    );
  }
}

export async function listMaintenanceRecommendationsForHouse(
  userId: string,
  houseId: string
) {
  const house = await getSavedHouse(userId, houseId);
  await ensureMaintenanceRecommendationInstancesForHouse(userId, house.id);
  const result = await pool.query<MaintenanceRecommendationRow>(
    `
      select
        ${maintenanceRecommendationReturningColumns()}
      from maintenance_recommendations
      where house_id = $1 and user_id = $2 and status = 'pending'
      order by
        suggested_due_date asc nulls last,
        case priority when 'high' then 1 when 'normal' then 2 else 3 end,
        created_at asc
    `,
    [house.id, userId]
  );

  return result.rows.map(toMaintenanceRecommendation);
}

export async function acceptMaintenanceRecommendationForHouse(
  userId: string,
  houseId: string,
  recommendationId: string,
  input: AcceptMaintenanceRecommendationRequest
) {
  const house = await getSavedHouse(userId, houseId);
  const client = await pool.connect();

  try {
    await client.query("begin");
    const recommendationResult = await client.query<MaintenanceRecommendationRow>(
      `
        select
          ${maintenanceRecommendationReturningColumns()}
        from maintenance_recommendations
        where id = $1 and house_id = $2 and user_id = $3
        for update
      `,
      [recommendationId, house.id, userId]
    );
    const recommendation = recommendationResult.rows[0];

    if (!recommendation) {
      throw new ApiError(404, "maintenance_recommendation_not_found", "Forslaget blev ikke fundet.");
    }

    if (recommendation.accepted_task_id) {
      const task = await getMaintenanceTaskForHouse(
        userId,
        house.id,
        recommendation.accepted_task_id
      );
      await client.query("commit");
      return task;
    }

    if (recommendation.status === "dismissed") {
      throw new ApiError(409, "maintenance_recommendation_dismissed", "Forslaget er allerede afvist.");
    }

    const selectedDueDate =
      input.dueDate ??
      (input.timing?.type === "specific_deadline" ? input.timing.dueDate : undefined);

    if (!selectedDueDate) {
      throw new ApiError(
        400,
        "maintenance_recommendation_due_date_required",
        "Tilføj til vedligeholdelse kræver en valgt dato."
      );
    }

    const timing = input.timing ?? {
      type: "specific_deadline" as const,
      dueDate: selectedDueDate
    };
    const recurrence = Object.prototype.hasOwnProperty.call(input, "recurrence")
      ? input.recurrence
      : Object.prototype.hasOwnProperty.call(input, "recurrenceInterval")
        ? input.recurrenceInterval
          ? {
              interval: input.recurrenceInterval,
              anchor: "completed_date" as const
            }
          : null
      : recommendation.recurrence_interval
        ? {
            interval: recommendation.recurrence_interval,
            anchor: recommendation.recurrence_anchor ?? "completed_date"
          }
        : null;
    const taskId = createOpaqueId("task");
    const originSnapshot = {
      title: recommendation.title,
      shortDescription: recommendation.description,
      componentKey: recommendation.component_key ?? "other",
      season: recommendation.season ?? "all_year",
      recommendedPeriod: recommendation.recommended_period ?? { type: "all_year" },
      defaultRecurrence: recommendation.recurrence_interval
        ? {
            interval: recommendation.recurrence_interval,
            anchor: recommendation.recurrence_anchor ?? "completed_date"
          }
        : null,
      priority: recommendation.priority ?? "normal",
      disclaimerClass: recommendation.disclaimer_class ?? "general",
      catalogKey: recommendation.catalog_key ?? recommendation.recommendation_key,
      catalogVersion: recommendation.catalog_version ?? recommendation.recommendation_key,
      recommendationInstanceId: recommendation.id
    };
    const taskResult = await client.query<MaintenanceTaskRow>(
      `
        insert into maintenance_tasks (
          id,
          house_id,
          user_id,
          title,
          description,
          source,
          status,
          timing_type,
          due_date,
          season,
          recommendation,
          recommendation_id,
          recurrence_interval,
          recurrence_anchor,
          component_key,
          origin_catalog_key,
          origin_catalog_version,
          origin_recommendation_instance_id,
          origin_snapshot
        )
        values ($1, $2, $3, $4, $5, 'recommendation_accepted', 'planned', $6, $7::date, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $10, $16::jsonb)
        returning
          ${maintenanceTaskReturningColumns()}
      `,
      [
        taskId,
        house.id,
        userId,
        recommendation.title,
        input.description ?? recommendation.description,
        timing.type,
        timing.dueDate ?? null,
        timing.season ?? null,
        JSON.stringify({
          recommendationId: recommendation.id,
          recommendationKey: recommendation.recommendation_key,
          catalogKey: originSnapshot.catalogKey,
          catalogVersion: originSnapshot.catalogVersion,
          recommendationInstanceId: recommendation.id,
          componentKey: recommendation.component_key ?? undefined,
          season: recommendation.season ?? undefined,
          reason: recommendation.description
        }),
        recommendation.id,
        recurrence?.interval ?? null,
        recurrence?.anchor ?? null,
        recommendation.component_key,
        originSnapshot.catalogKey,
        originSnapshot.catalogVersion,
        JSON.stringify(originSnapshot)
      ]
    );

    await client.query(
      `
        update maintenance_recommendations
        set status = 'accepted', accepted_task_id = $2, updated_at = now()
        where id = $1
      `,
      [recommendation.id, taskId]
    );
    await client.query("commit");
    return toMaintenanceTask(taskResult.rows[0] as MaintenanceTaskRow);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function dismissMaintenanceRecommendationForHouse(
  userId: string,
  houseId: string,
  recommendationId: string,
  mode: MaintenanceRecommendationDismissMode = "not_now"
) {
  const house = await getSavedHouse(userId, houseId);
  const client = await pool.connect();

  try {
    await client.query("begin");
    const existing = await client.query<MaintenanceRecommendationRow>(
      `
        select
          ${maintenanceRecommendationReturningColumns()}
        from maintenance_recommendations
        where id = $1 and house_id = $2 and user_id = $3
        for update
      `,
      [recommendationId, house.id, userId]
    );
    const recommendation = existing.rows[0];

    if (!recommendation || recommendation.status !== "pending") {
      throw new ApiError(404, "maintenance_recommendation_not_found", "Forslaget blev ikke fundet.");
    }

    if (mode === "hide_forever") {
      const catalogKey = recommendation.catalog_key ?? recommendation.recommendation_key;
      await client.query(
        `
          insert into maintenance_recommendation_hides (
            id,
            house_id,
            catalog_key
          )
          values ($1, $2, $3)
          on conflict (house_id, catalog_key) where unhidden_at is null do update
          set hidden_at = coalesce(maintenance_recommendation_hides.hidden_at, now()),
              updated_at = now()
        `,
        [createOpaqueId("mhide"), house.id, catalogKey]
      );
    }

    const result = await client.query<MaintenanceRecommendationRow>(
      `
        update maintenance_recommendations
        set status = 'dismissed', dismissed_at = coalesce(dismissed_at, now()), updated_at = now()
        where id = $1 and house_id = $2 and user_id = $3 and status = 'pending'
        returning
          ${maintenanceRecommendationReturningColumns()}
      `,
      [recommendationId, house.id, userId]
    );

    await client.query("commit");
    return toMaintenanceRecommendation(result.rows[0] as MaintenanceRecommendationRow);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeMaintenanceTaskForHouse(
  userId: string,
  houseId: string,
  taskId: string,
  input: CompleteMaintenanceTaskRequest
) {
  const house = await getSavedHouse(userId, houseId);
  const client = await pool.connect();
  const completedDate = input.completedDate ?? new Date().toISOString().slice(0, 10);

  try {
    await client.query("begin");
    const taskResult = await client.query<MaintenanceTaskRow>(
      `
        select
          ${maintenanceTaskReturningColumns()}
        from maintenance_tasks
        where id = $1 and house_id = $2 and deleted_at is null and archived_at is null
        for update
      `,
      [taskId, house.id]
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw new ApiError(404, "maintenance_task_not_found", "Opgaven blev ikke fundet.");
    }

    const existingCompletion = await client.query<{ id: string }>(
      "select id from maintenance_completions where task_id = $1",
      [task.id]
    );

    if (existingCompletion.rows[0]) {
      const history = await listMaintenanceHistoryForHouse(userId, house.id);
      await client.query("commit");
      return { task: toMaintenanceTask(task), historyEntry: history.find((entry) => entry.taskId === task.id) ?? null };
    }

    const completionResult = await client.query<MaintenanceCompletionRow>(
      `
        insert into maintenance_completions (
          id,
          task_id,
          house_id,
          user_id,
          title_snapshot,
          note,
          completed_date,
          price_amount_minor,
          price_currency,
          component_key,
          source,
          recurrence_interval,
          recurrence_anchor
        )
        values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13)
        returning
          id,
          task_id,
          house_id,
          title_snapshot,
          note,
          to_char(completed_date, 'YYYY-MM-DD') as completed_date,
          price_amount_minor,
          price_currency,
          component_key,
          source,
          recurrence_interval,
          recurrence_anchor,
          created_at
      `,
      [
        createOpaqueId("mcomp"),
        task.id,
        house.id,
        userId,
        task.title,
        input.note?.trim() || null,
        completedDate,
        task.price_amount_minor,
        task.price_currency,
        task.component_key,
        task.source,
        task.recurrence_interval,
        task.recurrence_anchor
      ]
    );

    await client.query(
      `
        update maintenance_tasks
        set status = 'done', completed_at = ($2::date)::timestamptz, updated_at = now()
        where id = $1
      `,
      [task.id, completedDate]
    );

    if (task.recurrence_interval) {
      const nextDate = nextDateForRecurrence(completedDate, task.recurrence_interval);
      const existingNext = await client.query<{ id: string }>(
        `
          select id
          from maintenance_tasks
          where house_id = $1
            and user_id = $2
            and title = $3
            and source = $4
            and status <> 'done'
            and deleted_at is null
            and archived_at is null
            and recurrence_interval = $5
            and coalesce(recommendation_id, '') = coalesce($6, '')
            and (
              ($7::date is not null and due_date = $7::date)
              or ($7::date is null and due_date is null and season is not distinct from $8)
            )
          limit 1
        `,
        [
          house.id,
          userId,
          task.title,
          task.source,
          task.recurrence_interval,
          task.recommendation_id,
          task.timing_type === "specific_deadline" ? nextDate : null,
          task.season
        ]
      );

      if (!existingNext.rows[0]) {
        await client.query(
          `
            insert into maintenance_tasks (
              id,
              house_id,
              user_id,
              title,
              description,
              source,
              status,
              timing_type,
              due_date,
              season,
              price_amount_minor,
              price_currency,
              recommendation,
              recommendation_id,
              recurrence_interval,
              recurrence_anchor,
              component_key,
              origin_catalog_key,
              origin_catalog_version,
              origin_recommendation_instance_id,
              origin_snapshot
            )
            values ($1, $2, $3, $4, $5, $6, 'planned', $7, $8::date, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20::jsonb)
          `,
          [
            createOpaqueId("task"),
            house.id,
            userId,
            task.title,
            task.description,
            task.source,
            task.timing_type === "specific_deadline" ? "specific_deadline" : task.timing_type,
            task.timing_type === "specific_deadline" ? nextDate : null,
            task.season,
            task.price_amount_minor,
            task.price_currency,
            task.recommendation ? JSON.stringify(task.recommendation) : null,
            task.recommendation_id,
            task.recurrence_interval,
            task.recurrence_anchor ?? "completed_date",
            task.component_key,
            task.origin_catalog_key,
            task.origin_catalog_version,
            task.origin_recommendation_instance_id,
            task.origin_snapshot ? JSON.stringify(task.origin_snapshot) : null
          ]
        );
      }
    }

    await client.query("commit");
    return {
      task: await getMaintenanceTaskForHouse(userId, house.id, task.id),
      historyEntry: toMaintenanceHistoryEntry(completionResult.rows[0] as MaintenanceCompletionRow)
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listMaintenanceHistoryForHouse(
  userId: string,
  houseId: string,
  query: MaintenanceHistoryQuery = {}
) {
  const house = await getSavedHouse(userId, houseId);
  const filters: string[] = ["c.house_id = $1", "c.user_id = $2"];
  const values: unknown[] = [house.id, userId];

  if (query.year) {
    values.push(query.year);
    filters.push(`extract(year from c.completed_date) = $${values.length}`);
  }

  if (query.componentKey) {
    values.push(query.componentKey);
    filters.push(`c.component_key = $${values.length}`);
  }

  const result = await pool.query<MaintenanceCompletionRow>(
    `
      select
        c.id,
        c.task_id,
        c.house_id,
        c.title_snapshot,
        c.note,
        to_char(c.completed_date, 'YYYY-MM-DD') as completed_date,
        c.price_amount_minor,
        c.price_currency,
        c.component_key,
        c.source,
        c.recurrence_interval,
        c.recurrence_anchor,
        c.created_at
      from maintenance_completions c
      where ${filters.join(" and ")}
      order by c.completed_date desc, c.created_at desc
    `,
    values
  );

  return result.rows.map(toMaintenanceHistoryEntry);
}

export async function getMaintenanceHistoryEntryForHouse(
  userId: string,
  houseId: string,
  completionId: string
): Promise<MaintenanceHistoryDetail> {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<MaintenanceCompletionRow>(
    `
      select
        c.id,
        c.task_id,
        c.house_id,
        c.title_snapshot,
        c.note,
        to_char(c.completed_date, 'YYYY-MM-DD') as completed_date,
        c.price_amount_minor,
        c.price_currency,
        c.component_key,
        c.source,
        c.recurrence_interval,
        c.recurrence_anchor,
        c.created_at
      from maintenance_completions c
      where c.id = $1 and c.house_id = $2 and c.user_id = $3
    `,
    [completionId, house.id, userId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "maintenance_history_not_found", "Historikposten blev ikke fundet.");
  }

  const taskResult = await pool.query<{ recommendation_id: string | null }>(
      "select recommendation_id from maintenance_tasks where id = $1 and house_id = $2",
      [row.task_id, house.id]
    );
  const recommendationId = taskResult.rows[0]?.recommendation_id;
  let recommendation: MaintenanceRecommendation | null = null;

  if (recommendationId) {
    const recommendationResult = await pool.query<MaintenanceRecommendationRow>(
      `
        select
          ${maintenanceRecommendationReturningColumns()}
        from maintenance_recommendations
        where id = $1 and house_id = $2 and user_id = $3
      `,
      [recommendationId, house.id, userId]
    );
    recommendation = recommendationResult.rows[0]
      ? toMaintenanceRecommendation(recommendationResult.rows[0])
      : null;
  }

  return maintenanceHistoryDetailSchema.parse({
    ...toMaintenanceHistoryEntry(row),
    recommendation
  });
}

export async function listHouseDocumentsForHouse(userId: string, houseId: string) {
  const house = await getSavedHouse(userId, houseId);
  const where = [
    "house_id = $1",
    "user_id = $2",
    "upload_status = 'uploaded'",
    "archived_at is null"
  ];
  const values: unknown[] = [house.id, userId];

  const result = await pool.query<HouseDocumentRow>(
    `
      select
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        created_at,
        updated_at
      from house_documents
      where ${where.join(" and ")}
      order by created_at desc
    `,
    values
  );

  return result.rows.map(toHouseDocument);
}

export async function createHouseDocumentForHouse(
  userId: string,
  houseId: string,
  input: {
    objectKey: string;
    originalFilename: string;
    mimeType: HouseDocument["mimeType"];
    sizeBytes: number;
    checksumSha256: string;
  }
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseDocumentRow>(
    `
      insert into house_documents (
        id,
        house_id,
        user_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        storage_provider
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', $9)
      returning
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        created_at,
        updated_at
    `,
    [
      createOpaqueId("doc"),
      house.id,
      userId,
      input.objectKey,
      input.originalFilename,
      input.mimeType,
      input.sizeBytes,
      input.checksumSha256,
      process.env.MATRIVA_STORAGE_ADAPTER === "local" ? "local" : "s3"
    ]
  );

  return toHouseDocument(result.rows[0] as HouseDocumentRow);
}

export async function getHouseDocumentForHouse(
  userId: string,
  houseId: string,
  documentId: string
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseDocumentRow>(
    `
      select
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        created_at,
        updated_at
      from house_documents
      where id = $1
        and house_id = $2
        and user_id = $3
        and upload_status = 'uploaded'
        and archived_at is null
    `,
    [documentId, house.id, userId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "house_document_not_found", "Dokumentet blev ikke fundet.");
  }

  return { document: toHouseDocument(row), objectKey: row.object_key };
}

export async function archiveHouseDocumentForHouse(
  userId: string,
  houseId: string,
  documentId: string
) {
  const { objectKey } = await getHouseDocumentForHouse(
    userId,
    houseId,
    documentId
  );
  const result = await pool.query<HouseDocumentRow>(
    `
      update house_documents
      set upload_status = 'archived', archived_at = now(), updated_at = now()
      where id = $1 and user_id = $2
      returning
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        created_at,
        updated_at
    `,
    [documentId, userId]
  );

  return {
    document: toHouseDocument(result.rows[0] as HouseDocumentRow),
    objectKey
  };
}

export async function countActiveDocumentObjectReferences(objectKey: string) {
  const result = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from house_documents
      where object_key = $1
        and upload_status = 'uploaded'
        and archived_at is null
    `,
    [objectKey]
  );

  return Number(result.rows[0]?.count ?? "0");
}

export async function listHouseImprovements(userId: string, houseId: string) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseImprovementRow>(
    `
      select
        id,
        house_id,
        title,
        description,
        category,
        to_char(improvement_date, 'YYYY-MM-DD') as improvement_date,
        improvement_year,
        cost_amount_minor,
        cost_currency,
        document_reference,
        status,
        created_at,
        updated_at
      from house_improvements
      where house_id = $1 and user_id = $2
      order by coalesce(improvement_date, make_date(improvement_year, 1, 1)) desc, created_at desc
    `,
    [house.id, userId]
  );

  return result.rows.map(toHouseImprovement);
}

export async function createHouseImprovement(
  userId: string,
  houseId: string,
  input: CreateHouseImprovementRequest
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseImprovementRow>(
    `
      insert into house_improvements (
        id,
        house_id,
        user_id,
        title,
        description,
        category,
        improvement_date,
        improvement_year,
        cost_amount_minor,
        cost_currency,
        document_reference,
        status
      )
      values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12)
      returning
        id,
        house_id,
        title,
        description,
        category,
        to_char(improvement_date, 'YYYY-MM-DD') as improvement_date,
        improvement_year,
        cost_amount_minor,
        cost_currency,
        document_reference,
        status,
        created_at,
        updated_at
    `,
    [
      createOpaqueId("impr"),
      house.id,
      userId,
      input.title.trim(),
      input.description?.trim() || null,
      input.category ?? null,
      input.improvementDate ?? null,
      input.improvementYear ?? null,
      input.costAmountMinor ?? null,
      input.costCurrency ?? null,
      input.documentReference?.trim() || null,
      input.status ?? (input.documentReference ? "documented" : "completed")
    ]
  );

  return toHouseImprovement(result.rows[0] as HouseImprovementRow);
}

export async function getCurrentHousePhoto(userId: string, houseId: string) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseMediaRow>(
    `
      select
        id,
        house_id,
        media_type,
        mime_type,
        size_bytes,
        width,
        height,
        storage_key,
        created_at,
        updated_at
      from house_media
      where house_id = $1 and user_id = $2 and is_current_house_photo
      order by created_at desc
      limit 1
    `,
    [house.id, userId]
  );
  const row = result.rows[0];

  return row ? toHouseMedia(row) : null;
}

export async function replaceHousePhoto(
  userId: string,
  houseId: string,
  input: {
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    storageKey: string;
  }
) {
  const house = await getSavedHouse(userId, houseId);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
        update house_media
        set is_current_house_photo = false, updated_at = now()
        where house_id = $1 and user_id = $2 and is_current_house_photo
      `,
      [house.id, userId]
    );
    const result = await client.query<HouseMediaRow>(
      `
        insert into house_media (
          id,
          house_id,
          user_id,
          media_type,
          mime_type,
          size_bytes,
          width,
          height,
          storage_key,
          is_current_house_photo
        )
        values ($1, $2, $3, 'house_photo', $4, $5, $6, $7, $8, true)
        returning
          id,
          house_id,
          media_type,
          mime_type,
          size_bytes,
          width,
          height,
          storage_key,
          created_at,
          updated_at
      `,
      [
        createOpaqueId("media"),
        house.id,
        userId,
        input.mimeType,
        input.sizeBytes,
        input.width ?? null,
        input.height ?? null,
        input.storageKey
      ]
    );
    await client.query("commit");

    return toHouseMedia(result.rows[0] as HouseMediaRow);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function removeHousePhoto(userId: string, houseId: string) {
  const house = await getSavedHouse(userId, houseId);
  await pool.query(
    `
      update house_media
      set is_current_house_photo = false, updated_at = now()
      where house_id = $1 and user_id = $2 and is_current_house_photo
    `,
    [house.id, userId]
  );
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
    onboarding: {
      state: onboardingState
    },
    houses,
    activeHouseId: houses[0]?.id ?? null,
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
