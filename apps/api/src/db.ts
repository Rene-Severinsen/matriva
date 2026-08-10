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
  UpdateHouseImprovementRequest,
  AttachHouseImprovementDocumentRequest,
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
  UpdateMaintenanceSettingsRequest,
  UpdateDefaultHouseRequest,
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
  const isProductionRuntime = process.env.NODE_ENV === "production";
  const isQaEnvironment = process.env.MATRIVA_ENVIRONMENT === "qa";

  if (
    isProductionRuntime &&
    !isQaEnvironment &&
    authLimitsDisabled()
  ) {
    throw new Error(
      "MATRIVA_AUTH_DISABLE_LIMITS=true is only allowed outside production or in the QA environment."
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
  prompt_for_completion_note: boolean;
  default_house_id: string | null;
};

type HouseRow = {
  id: string;
  user_id: string;
  bfe_number: string | null;
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
  created_by_user_id: string | null;
  created_by_display_name: string | null;
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
  archived_at: Date | null;
  deleted_at: Date | null;
  recommendation_id: string | null;
  origin_catalog_key: string | null;
  origin_catalog_version: string | null;
  origin_recommendation_instance_id: string | null;
  origin_snapshot: unknown;
  generated_from_completion_id: string | null;
  restored_note_draft: string | null;
  generated_state_fingerprint: string | null;
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
  user_id: string;
  title_snapshot: string;
  note: string | null;
  completed_date: string;
  price_amount_minor: number | null;
  price_currency: "DKK";
  source: MaintenanceTask["source"];
  recurrence_interval: string | null;
  recurrence_anchor: string | null;
  created_at: Date;
  reversed_at: Date | null;
  reversed_by_user_id: string | null;
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
  created_at: Date | string;
  updated_at: Date | string;
  title: string | null;
  category: HouseDocument["category"];
  document_type: HouseDocument["documentType"];
  document_date: Date | string | null;
  related_party: string | null;
  amount_minor: number | null;
  currency: "DKK";
  expires_at: Date | string | null;
  is_important: boolean;
  note: string | null;
  analysis_status: HouseDocument["analysisStatus"];
  analysis_version: string | null;
  analysis_requested_at: Date | string | null;
  analysis_started_at: Date | string | null;
  analysis_completed_at: Date | string | null;
  analysis_error_code: string | null;
  detected_document_type: HouseDocument["detectedDocumentType"];
  extracted_metadata: Record<string, unknown>;
};

type HouseImprovementRow = {
  id: string;
  house_id: string;
  title: string;
  description: string | null;
  category: HouseImprovement["category"];
  completed_date: string;
  total_amount_minor: number | null;
  currency: "DKK";
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  document_count: number;
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
    | "hm"
    | "claim"
    | "invite"
    | "task"
    | "mlt"
    | "sess"
    | "pubsnap"
    | "pubbld"
    | "pubunt"
    | "pubflr"
    | "pubpar"
    | "impr"
    | "impitem"
    | "impexp"
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

function isoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
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
    user_id as created_by_user_id,
    (select up.display_name from user_profiles up where up.user_id = maintenance_tasks.user_id) as created_by_display_name,
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
    archived_at,
    deleted_at,
    recommendation_id,
    origin_catalog_key,
    origin_catalog_version,
    origin_recommendation_instance_id,
    origin_snapshot,
    generated_from_completion_id,
    restored_note_draft,
    generated_state_fingerprint,
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

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeFingerprintValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalizeFingerprintValue(item)])
    );
  }

  return value ?? null;
}

function maintenanceGeneratedTaskFingerprint(task: {
  title: string;
  description: string | null;
  source: string;
  status: string;
  timing_type: string;
  due_date: string | null;
  season: string | null | undefined;
  price_amount_minor: number | null;
  price_currency: string;
  recommendation: unknown;
  recommendation_id: string | null;
  recurrence_interval: string | null;
  recurrence_anchor: string | null;
}) {
  const canonical = canonicalizeFingerprintValue({
    title: task.title,
    description: task.description,
    source: task.source,
    status: task.status,
    timingType: task.timing_type,
    dueDate: task.due_date,
    season: task.season,
    priceAmountMinor: task.price_amount_minor,
    priceCurrency: task.price_currency,
    recommendation: task.recommendation,
    recommendationId: task.recommendation_id,
    recurrenceInterval: task.recurrence_interval,
    recurrenceAnchor: task.recurrence_anchor
  });

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
    status: row.status,
    emailVerifiedAt: isoDate(row.email_verified_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastLoginAt: isoDate(row.last_login_at)
  });
}

function toProfile(row: UserProfileRow | undefined): UserProfile {
  return userProfileSchema.parse({
    displayName: row?.display_name ?? null,
    preferredLocale: row?.preferred_locale ?? "da-DK",
    promptForCompletionNote: row?.prompt_for_completion_note ?? true,
    defaultHouseId: row?.default_house_id ?? null
  });
}

function toSavedHouse(row: HouseRow): SavedHouse {
  return savedHouseSchema.parse({
    id: row.id,
    ownerUserId: row.user_id,
    bfeNumber: row.bfe_number,
    addressLabel: row.address_label,
    ...(row.dawa_address_id ? { dawaAddressId: row.dawa_address_id } : {}),
    ...(row.source_access_address_id ? { dawaAccessAddressId: row.source_access_address_id } : {}),
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
    createdByUserId: row.created_by_user_id,
    createdByDisplayName: row.created_by_display_name,
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
    archivedAt: isoDate(row.archived_at),
    restoredNoteDraft: row.restored_note_draft,
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
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
    title: row.title ?? null,
    category: row.category ?? null,
    documentType: row.document_type ?? null,
    documentDate: dateOnly(row.document_date),
    relatedParty: row.related_party ?? null,
    amountMinor: row.amount_minor ?? null,
    currency: row.currency ?? "DKK",
    expiresAt: dateOnly(row.expires_at),
    isImportant: row.is_important ?? false,
    note: row.note ?? null,
    analysisStatus: row.analysis_status ?? "not_requested",
    analysisVersion: row.analysis_version ?? null,
    analysisRequestedAt: isoDate(row.analysis_requested_at),
    analysisStartedAt: isoDate(row.analysis_started_at),
    analysisCompletedAt: isoDate(row.analysis_completed_at),
    analysisErrorCode: row.analysis_error_code ?? null,
    detectedDocumentType: row.detected_document_type ?? null,
    extractedMetadata: row.extracted_metadata ?? {}
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
    completedDate: row.completed_date,
    totalAmountMinor: row.total_amount_minor === null ? null : Number(row.total_amount_minor),
    currency: row.currency,
    documentCount: Number(row.document_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    archivedAt: row.archived_at?.toISOString() ?? null
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

export async function createSessionForUser(userId: string): Promise<SessionTokens> {
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

export async function getUserByEmail(email: string) {
  const result = await pool.query<UserRow>("select * from users where email = $1", [
    normalizeEmail(email)
  ]);
  const row = result.rows[0];

  if (!row || row.status !== "active") {
    return null;
  }

  return toCurrentUser(row);
}

export async function getProfileForUser(userId: string) {
  const result = await pool.query<UserProfileRow>(
    `select up.display_name, up.preferred_locale, up.prompt_for_completion_note,
            case when exists (
              select 1 from house_memberships hm
              join houses h on h.id = hm.house_id
              where hm.user_id = up.user_id and hm.house_id = up.default_house_id
                and hm.status = 'active' and h.status = 'saved'
            ) then up.default_house_id else null end as default_house_id
     from user_profiles up where up.user_id = $1`,
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
      returning display_name, preferred_locale, prompt_for_completion_note, default_house_id
    `,
    [userId, input.displayName.trim(), input.preferredLocale ?? "da-DK"]
  );

  return toProfile(result.rows[0]);
}

export async function updateMaintenanceSettings(
  userId: string,
  input: UpdateMaintenanceSettingsRequest
) {
  const result = await pool.query<UserProfileRow>(
    `
      update user_profiles
      set prompt_for_completion_note = $2, updated_at = now()
      where user_id = $1
      returning display_name, preferred_locale, prompt_for_completion_note, default_house_id
    `,
    [userId, input.promptForCompletionNote]
  );

  return toProfile(result.rows[0]);
}

export async function updateDefaultHouse(userId: string, input: UpdateDefaultHouseRequest) {
  if (input.houseId) {
    const membership = await pool.query(
      `select 1 from houses h join house_memberships hm on hm.house_id = h.id
       where h.id = $1 and h.status = 'saved' and hm.user_id = $2 and hm.status = 'active'`,
      [input.houseId, userId]
    );
    if (!membership.rowCount) {
      throw new ApiError(400, "default_house_not_accessible", "Du har ikke aktiv adgang til den valgte bolig.");
    }
  }

  const result = await pool.query<UserProfileRow>(
    `update user_profiles set default_house_id = $2, updated_at = now()
     where user_id = $1
     returning display_name, preferred_locale, prompt_for_completion_note, default_house_id`,
    [userId, input.houseId]
  );
  return toProfile(result.rows[0]);
}

export async function requireHouseMembership(userId: string, houseId: string) {
  const result = await pool.query<{ id: string }>(
    `select h.id from houses h join house_memberships hm on hm.house_id = h.id
     where h.id = $1 and hm.user_id = $2 and hm.status = 'active' and h.status = 'saved'`,
    [houseId, userId]
  );
  if (!result.rowCount) {
    throw new ApiError(404, "house_not_found", "Saved house was not found.");
  }
}

export async function findHouseByBfe(bfeNumber: string) {
  const result = await pool.query<HouseRow>(
    "select * from houses where bfe_number = $1 and status = 'saved' limit 1", [bfeNumber]
  );
  return result.rows[0] ? toSavedHouse(result.rows[0]) : null;
}

export async function hasActiveHouseMembership(userId: string, houseId: string) {
  const result = await pool.query("select 1 from house_memberships where house_id = $1 and user_id = $2 and status = 'active'", [houseId, userId]);
  return Boolean(result.rowCount);
}

export async function createHouseClaim(userId: string, houseId: string, claimType: "owner" | "resident" | "household_member") {
  const ownerActionToken = createToken();
  const result = await pool.query(
    `insert into house_claims (id, house_id, user_id, claim_type) values ($1, $2, $3, $4)
     on conflict (house_id, user_id) where status = 'pending' do update set updated_at = now()
     returning id, house_id, user_id, claim_type, status, requested_at, resolved_at, resolution_note`,
    [createOpaqueId("claim"), houseId, userId, claimType]
  );
  const row = result.rows[0];
  await pool.query(
    `update house_claims set owner_action_token_hash = $1, owner_action_expires_at = now() + interval '7 days', updated_at = now() where id = $2`,
    [hashSecret(ownerActionToken), row.id]
  );
  const notifications = await pool.query(
    `select c.id, c.claim_type, c.requested_at, h.address_label, h.bfe_number,
            requester.email as requester_email, coalesce(requester_profile.display_name, requester.email) as requester_name,
            owner.email as owner_email, coalesce(owner_profile.display_name, owner.email) as owner_name
     from house_claims c
     join houses h on h.id = c.house_id
     join users requester on requester.id = c.user_id
     left join user_profiles requester_profile on requester_profile.user_id = requester.id
     join house_memberships membership on membership.house_id = c.house_id and membership.role = 'owner' and membership.status = 'active'
     join users owner on owner.id = membership.user_id
     left join user_profiles owner_profile on owner_profile.user_id = owner.id
     where c.id = $1`,
    [row.id]
  );
  return {
    claim: { id: row.id, houseId: row.house_id, userId: row.user_id, claimType: row.claim_type, status: row.status, requestedAt: new Date(row.requested_at).toISOString(), resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null, resolutionNote: row.resolution_note },
    ownerActionToken,
    ownerActionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    notifications: notifications.rows
  };
}

export async function approveHouseClaimByOwnerToken(userId: string, token: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `select c.*, h.address_label from house_claims c join houses h on h.id = c.house_id
       where c.owner_action_token_hash = $1 and c.status = 'pending' and c.owner_action_expires_at > now() for update`,
      [hashSecret(token)]
    );
    const claim = result.rows[0];
    if (!claim) throw new ApiError(404, "house_claim_action_invalid", "Adgangsanmodningen er ugyldig eller udløbet.");
    const owner = await client.query("select 1 from house_memberships where house_id = $1 and user_id = $2 and role = 'owner' and status = 'active'", [claim.house_id, userId]);
    if (!owner.rowCount) throw new ApiError(403, "house_owner_required", "Kun en aktiv ejer kan godkende adgang.");
    await client.query("insert into house_memberships (id, house_id, user_id, role, status, invited_by_user_id) values ($1, $2, $3, 'member', 'active', $4) on conflict (house_id, user_id) where status = 'active' do nothing", [createOpaqueId("hm"), claim.house_id, claim.user_id, userId]);
    await client.query("update house_claims set status = 'approved', resolved_at = now(), resolved_by_owner_user_id = $1, resolution_note = 'Godkendt af ejer', owner_action_token_hash = null, owner_action_expires_at = null, updated_at = now() where id = $2", [userId, claim.id]);
    await client.query("commit");
    return { id: claim.id, status: "approved" as const, houseId: claim.house_id };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function resolveHouseClaimByOwner(userId: string, claimId: string, decision: "approve" | "reject") {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const claimResult = await client.query("select * from house_claims where id = $1 and status = 'pending' for update", [claimId]);
    const claim = claimResult.rows[0];
    if (!claim) throw new ApiError(404, "house_claim_not_found", "Adgangsanmodningen blev ikke fundet.");
    const owner = await client.query("select 1 from house_memberships where house_id = $1 and user_id = $2 and role = 'owner' and status = 'active'", [claim.house_id, userId]);
    if (!owner.rowCount) throw new ApiError(403, "house_owner_required", "Kun en aktiv ejer kan håndtere adgang.");
    if (decision === "approve") {
      await client.query("insert into house_memberships (id, house_id, user_id, role, status, invited_by_user_id) values ($1, $2, $3, 'member', 'active', $4) on conflict (house_id, user_id) where status = 'active' do nothing", [createOpaqueId("hm"), claim.house_id, claim.user_id, userId]);
    }
    await client.query("update house_claims set status = $1, resolved_at = now(), resolved_by_owner_user_id = $2, resolution_note = $3, owner_action_token_hash = null, owner_action_expires_at = null, updated_at = now() where id = $4", [decision === "approve" ? "approved" : "rejected", userId, decision === "approve" ? "Godkendt af ejer" : "Afvist af ejer", claimId]);
    await client.query("commit");
    return { id: claimId, status: decision === "approve" ? "approved" as const : "rejected" as const, houseId: claim.house_id };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function listHouseMembers(userId: string, houseId: string) {
  await requireHouseMembership(userId, houseId);
  const current = await pool.query<{ role: "owner" | "member" }>("select role from house_memberships where house_id = $1 and user_id = $2 and status = 'active'", [houseId, userId]);
  const result = await pool.query(`select hm.id, hm.house_id, hm.user_id, hm.role, hm.status, hm.valid_from, hm.valid_to, up.display_name
    from house_memberships hm left join user_profiles up on up.user_id = hm.user_id
    where hm.house_id = $1 and hm.status = 'active' order by hm.valid_from`, [houseId]);
  const invitations = await pool.query(`select id, house_id, email, role, status, expires_at from house_invitations where house_id = $1 and status = 'pending' and expires_at > now() order by created_at desc`, [houseId]);
  return {
    canManage: current.rows[0]?.role === "owner",
    members: result.rows.map((row) => ({ id: row.id, houseId: row.house_id, userId: row.user_id, role: row.role, status: row.status, validFrom: new Date(row.valid_from).toISOString(), validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null, displayName: row.display_name })),
    invitations: invitations.rows.map((row) => ({ id: row.id, houseId: row.house_id, email: row.email, role: row.role, status: row.status, expiresAt: new Date(row.expires_at).toISOString() }))
  };
}

export async function revokeHouseMembership(userId: string, houseId: string, membershipId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owner = await client.query(
      "select 1 from house_memberships where house_id = $1 and user_id = $2 and role = 'owner' and status = 'active' for update",
      [houseId, userId]
    );
    if (!owner.rowCount) throw new ApiError(403, "house_owner_required", "Kun en aktiv ejer kan fjerne medlemmer.");

    const membership = await client.query<{ id: string; user_id: string }>(
      "select id, user_id from house_memberships where id = $1 and house_id = $2 and status = 'active' for update",
      [membershipId, houseId]
    );
    const target = membership.rows[0];
    if (!target) throw new ApiError(404, "house_membership_not_found", "Medlemmet blev ikke fundet.");
    if (target.user_id === userId) throw new ApiError(400, "owner_self_removal_forbidden", "Ejeren kan ikke fjerne sig selv.");

    await client.query(
      "update house_memberships set status = 'revoked', valid_to = now(), updated_at = now() where id = $1",
      [membershipId]
    );
    await client.query("commit");
    return { id: membershipId, houseId, status: "revoked" as const };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeHouseInvitation(userId: string, houseId: string, invitationId: string) {
  const owner = await pool.query("select 1 from house_memberships where house_id = $1 and user_id = $2 and role = 'owner' and status = 'active'", [houseId, userId]);
  if (!owner.rowCount) throw new ApiError(403, "house_owner_required", "Only an owner can revoke invitations.");
  const result = await pool.query("update house_invitations set status = 'revoked', updated_at = now() where id = $1 and house_id = $2 and status = 'pending' returning id", [invitationId, houseId]);
  if (!result.rowCount) throw new ApiError(404, "house_invitation_not_found", "Invitationen blev ikke fundet.");
  return { id: invitationId, status: "revoked" as const };
}

export async function createHouseInvitation(userId: string, houseId: string, email: string, role: "owner" | "member") {
  await requireHouseMembership(userId, houseId);
  const owner = await pool.query("select 1 from house_memberships where house_id = $1 and user_id = $2 and role = 'owner' and status = 'active'", [houseId, userId]);
  if (!owner.rowCount) throw new ApiError(403, "house_owner_required", "Only an owner can invite members.");
  const normalized = normalizeEmail(email);
  const existingMember = await pool.query("select hm.house_id from house_memberships hm join users u on u.id = hm.user_id where hm.house_id = $1 and u.email = $2 and hm.status = 'active'", [houseId, normalized]);
  if (existingMember.rowCount) return { alreadyMember: true as const, houseId };
  const existingInvitation = await pool.query("select id, house_id, email, role, status, expires_at from house_invitations where house_id = $1 and email = $2 and status = 'pending' and expires_at > now()", [houseId, normalized]);
  if (existingInvitation.rowCount) {
    const pending = existingInvitation.rows[0];
    return {
      alreadyPending: true as const,
      invitation: {
        id: pending.id,
        houseId: pending.house_id,
        email: pending.email,
        role: pending.role,
        status: pending.status,
        expiresAt: new Date(pending.expires_at).toISOString()
      }
    };
  }
  const token = createToken();
  const result = await pool.query(`insert into house_invitations (id, house_id, email, role, token_hash, expires_at, invited_by_user_id)
    values ($1, $2, $3, $4, $5, now() + interval '7 days', $6) returning id, house_id, email, role, status, expires_at`, [createOpaqueId("invite"), houseId, normalized, role, hashSecret(token), userId]);
  return { ...result.rows[0], token };
}

export async function acceptHouseInvitation(userId: string, token: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(`select i.*, u.email as accepting_email from house_invitations i cross join users u
      where u.id = $1 and i.token_hash = $2 and i.status = 'pending' and i.expires_at > now() for update`, [userId, hashSecret(token)]);
    const invitation = result.rows[0];
    if (!invitation) {
      const tokenResult = await client.query("select email, status, expires_at, accepted_by_user_id, house_id from house_invitations where token_hash = $1", [hashSecret(token)]);
      if (tokenResult.rows[0]?.status === "accepted" && tokenResult.rows[0].accepted_by_user_id === userId) { await client.query("commit"); return { houseId: tokenResult.rows[0].house_id }; }
      if (tokenResult.rows[0]?.status === "pending" && new Date(tokenResult.rows[0].expires_at) > new Date()) throw new ApiError(403, "invitation_email_mismatch", "Invitationen er knyttet til en anden e-mailadresse.");
      throw new ApiError(404, "invitation_not_found", "Invitationen er ugyldig eller udløbet.");
    }
    if (invitation.email !== invitation.accepting_email) throw new ApiError(403, "invitation_email_mismatch", "Invitationen er knyttet til en anden e-mailadresse.");
    await client.query(`insert into house_memberships (id, house_id, user_id, role, status, invited_by_user_id) values ($1, $2, $3, $4, 'active', $5)
      on conflict (house_id, user_id) where status = 'active' do nothing`, [createOpaqueId("hm"), invitation.house_id, userId, invitation.role, invitation.invited_by_user_id]);
    await client.query(`update house_invitations set status = 'accepted', accepted_by_user_id = $1, accepted_at = now(), updated_at = now() where id = $2`, [userId, invitation.id]);
    await client.query("commit");
    return { houseId: invitation.house_id };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function acceptHouseInvitationById(userId: string, invitationId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `select i.*, u.email as accepting_email from house_invitations i cross join users u
       where u.id = $1 and i.id = $2 and i.status = 'pending' and i.expires_at > now() for update`,
      [userId, invitationId]
    );
    const invitation = result.rows[0];
    if (!invitation) throw new ApiError(404, "invitation_not_found", "Invitationen er ugyldig eller udløbet.");
    if (normalizeEmail(invitation.email) !== normalizeEmail(invitation.accepting_email)) throw new ApiError(403, "invitation_email_mismatch", "Invitationen er knyttet til en anden e-mailadresse.");
    await client.query("insert into house_memberships (id, house_id, user_id, role, status, invited_by_user_id) values ($1, $2, $3, $4, 'active', $5) on conflict (house_id, user_id) where status = 'active' do nothing", [createOpaqueId("hm"), invitation.house_id, userId, invitation.role, invitation.invited_by_user_id]);
    await client.query("update house_invitations set status = 'accepted', accepted_by_user_id = $1, accepted_at = now(), updated_at = now() where id = $2", [userId, invitation.id]);
    await client.query("commit");
    return { houseId: invitation.house_id };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function resolveHouseClaim(claimId: string, adminUserId: string, decision: "approve" | "reject", note: string | null) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const claimResult = await client.query("select * from house_claims where id = $1 and status = 'pending' for update", [claimId]);
    const claim = claimResult.rows[0];
    if (!claim) throw new ApiError(404, "house_claim_not_found", "Adgangskravet blev ikke fundet.");
    if (decision === "approve") {
      await client.query(`insert into house_memberships (id, house_id, user_id, role, status) values ($1, $2, $3, 'member', 'active') on conflict (house_id, user_id) where status = 'active' do nothing`, [createOpaqueId("hm"), claim.house_id, claim.user_id]);
    }
    await client.query(`update house_claims set status = $1, resolved_at = now(), resolved_by_admin_user_id = $2, resolution_note = $3, updated_at = now() where id = $4`, [decision === "approve" ? "approved" : "rejected", adminUserId, note, claimId]);
    await client.query("commit");
    return { id: claimId, status: decision === "approve" ? "approved" : "rejected" };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}

export async function createSavedHouse(userId: string, input: SelectedAddressInput, bfeNumber: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query<HouseRow>(
      `select h.* from houses h
       where h.bfe_number = $1 and h.status = 'saved' limit 1`, [bfeNumber]
    );
    if (existing.rowCount) {
      await client.query("commit");
      return toSavedHouse(existing.rows[0] as HouseRow);
    }
    let result: { rows: HouseRow[] };
    try {
      result = await client.query<HouseRow>(
        `insert into houses (id, user_id, dev_user_id, bfe_number, address_label, dawa_address_id, source_access_address_id, dawa_access_address_id)
         values ($1, $2, null, $3, $4, $5, $6, $6) returning *`,
        [createOpaqueId("house"), userId, bfeNumber, input.label, input.sourceAddressId, input.sourceAccessAddressId ?? null]
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
      const raced = await client.query<HouseRow>("select * from houses where bfe_number = $1 and status = 'saved'", [bfeNumber]);
      if (!raced.rowCount) throw error;
      await client.query("commit");
      return toSavedHouse(raced.rows[0] as HouseRow);
    }
    const house = result.rows[0] as HouseRow;
    await client.query(
      `insert into house_memberships (id, house_id, user_id, role, status)
       values ($1, $2, $3, 'owner', 'active')
       on conflict (house_id, user_id) where status = 'active' do nothing`,
      [createOpaqueId("hm"), house.id, userId]
    );
    await client.query("commit");
    return toSavedHouse(house);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

export async function listSavedHouses(userId: string) {
  const result = await pool.query<HouseRow>(
    "select h.* from houses h join house_memberships hm on hm.house_id = h.id where hm.user_id = $1 and hm.status = 'active' and h.status = 'saved' order by h.created_at desc",
    [userId]
  );

  return result.rows.map(toSavedHouse);
}

export async function getSavedHouse(userId: string, houseId: string) {
  const result = await pool.query<HouseRow>(
    "select h.* from houses h join house_memberships hm on hm.house_id = h.id where h.id = $1 and hm.user_id = $2 and hm.status = 'active' and h.status = 'saved'",
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
        completed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13::jsonb, $14, $15, $16)
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
  if (interval === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().slice(0, 10);
  }
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
        price_amount_minor = case when $13::boolean then $14 else price_amount_minor end,
        price_currency = case when $13::boolean then coalesce($15, 'DKK') else price_currency end,
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
          season,
          recommended_period,
          default_recurrence_interval,
          priority,
          eligibility_rules,
          disclaimer_class,
          is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12)
        on conflict (catalog_key, catalog_version) do update
        set
          title = excluded.title,
          short_description = excluded.short_description,
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
          and t.origin_catalog_key = $2
          and t.deleted_at is null
          and t.archived_at is null
          and t.status <> 'done'
        limit 1
      `,
      [houseId, item.catalog_key]
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
          $14::jsonb,
          $15::jsonb,
          $5,
          $16,
          $17,
          $18,
          $19
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
  houseId: string,
  status: "pending" | "dismissed" = "pending"
) {
  const house = await getSavedHouse(userId, houseId);
  if (status === "pending") {
    await ensureMaintenanceRecommendationInstancesForHouse(userId, house.id);
  }
  const result = await pool.query<MaintenanceRecommendationRow>(
    `
      select
        ${maintenanceRecommendationReturningColumns()}
      from maintenance_recommendations
      where house_id = $1 and status = $2
        and (
          $2 = 'pending'
          or not exists (
            select 1
            from maintenance_recommendation_hides mh
            where mh.house_id = maintenance_recommendations.house_id
              and mh.catalog_key = coalesce(
                maintenance_recommendations.catalog_key,
                maintenance_recommendations.recommendation_key
              )
              and mh.unhidden_at is null
          )
        )
      order by
        suggested_due_date asc nulls last,
        case priority when 'high' then 1 when 'normal' then 2 else 3 end,
        created_at asc
    `,
    [house.id, status]
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
        where id = $1 and house_id = $2
        for update
      `,
      [recommendationId, house.id]
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
          origin_catalog_key,
          origin_catalog_version,
          origin_recommendation_instance_id,
          origin_snapshot
        )
        values ($1, $2, $3, $4, $5, 'recommendation_accepted', 'planned', $6, $7::date, $8, $9::jsonb, $10, $11, $12, $13, $14, $10, $15::jsonb)
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
          season: recommendation.season ?? undefined,
          reason: recommendation.description
        }),
        recommendation.id,
        recurrence?.interval ?? null,
        recurrence?.anchor ?? null,
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
        where id = $1 and house_id = $2
        for update
      `,
      [recommendationId, house.id]
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
        where id = $1 and house_id = $2 and status = 'pending'
        returning
          ${maintenanceRecommendationReturningColumns()}
      `,
      [recommendationId, house.id]
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

export async function restoreMaintenanceRecommendationForHouse(
  userId: string,
  houseId: string,
  recommendationId: string
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<MaintenanceRecommendationRow>(
    `
      update maintenance_recommendations mr
      set status = 'pending', dismissed_at = null, updated_at = now()
      where mr.id = $1
        and mr.house_id = $2
        and mr.status = 'dismissed'
        and not exists (
          select 1
          from maintenance_recommendation_hides mh
          where mh.house_id = mr.house_id
            and mh.catalog_key = coalesce(mr.catalog_key, mr.recommendation_key)
            and mh.unhidden_at is null
        )
      returning ${maintenanceRecommendationReturningColumns()}
    `,
    [recommendationId, house.id]
  );

  if (!result.rows[0]) {
    throw new ApiError(
      409,
      "maintenance_recommendation_not_restorable",
      "Forslaget kan ikke gendannes."
    );
  }

  return toMaintenanceRecommendation(result.rows[0]);
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
      "select id from maintenance_completions where task_id = $1 and reversed_at is null",
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
          source,
          recurrence_interval,
          recurrence_anchor
        )
        values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10, $11, $12)
        returning
          id,
          task_id,
          house_id,
          title_snapshot,
          note,
          to_char(completed_date, 'YYYY-MM-DD') as completed_date,
          price_amount_minor,
          price_currency,
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
        task.source,
        task.recurrence_interval,
        task.recurrence_anchor
      ]
    );

    const completedTaskResult = await client.query<MaintenanceTaskRow>(
      `
        update maintenance_tasks
        set status = 'done', completed_at = ($2::date)::timestamptz, restored_note_draft = null, updated_at = now()
        where id = $1
        returning
          ${maintenanceTaskReturningColumns()}
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
            and title = $2
            and source = $3
            and status <> 'done'
            and deleted_at is null
            and archived_at is null
            and recurrence_interval = $4
            and coalesce(recommendation_id, '') = coalesce($5, '')
            and (
              ($6::date is not null and due_date = $6::date)
              or ($6::date is null and due_date is null and season is not distinct from $7)
            )
          limit 1
        `,
        [
          house.id,
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
              origin_catalog_key,
              origin_catalog_version,
              origin_recommendation_instance_id,
              origin_snapshot,
              generated_from_completion_id,
              generated_state_fingerprint
            )
            values ($1, $2, $3, $4, $5, $6, 'planned', $7, $8::date, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21)
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
            task.origin_catalog_key,
            task.origin_catalog_version,
            task.origin_recommendation_instance_id,
            task.origin_snapshot ? JSON.stringify(task.origin_snapshot) : null,
            (completionResult.rows[0] as MaintenanceCompletionRow).id,
            maintenanceGeneratedTaskFingerprint({
              title: task.title,
              description: task.description,
              source: task.source,
              status: "planned",
              timing_type: task.timing_type,
              due_date: task.timing_type === "specific_deadline" ? nextDate : null,
              season: task.season ?? null,
              price_amount_minor: task.price_amount_minor,
              price_currency: task.price_currency,
              recommendation: task.recommendation,
              recommendation_id: task.recommendation_id,
              recurrence_interval: task.recurrence_interval,
              recurrence_anchor: task.recurrence_anchor ?? "completed_date"
            })
          ]
        );
      }
    }

    await client.query("commit");
    return {
      task: toMaintenanceTask(completedTaskResult.rows[0] as MaintenanceTaskRow),
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
  const filters: string[] = ["c.house_id = $1", "c.reversed_at is null"];
  const values: unknown[] = [house.id];

  if (query.year) {
    values.push(query.year);
    filters.push(`extract(year from c.completed_date) = $${values.length}`);
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

export async function reverseMaintenanceCompletionForHouse(
  userId: string,
  houseId: string,
  completionId: string,
  noteHandling: "keep_as_draft" | "discard"
) {
  const house = await getSavedHouse(userId, houseId);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const completionResult = await client.query<MaintenanceCompletionRow>(
      `
        select
          id,
          task_id,
          house_id,
          user_id,
          title_snapshot,
          note,
          to_char(completed_date, 'YYYY-MM-DD') as completed_date,
          price_amount_minor,
          price_currency,
          source,
          recurrence_interval,
          recurrence_anchor,
          created_at,
          reversed_at,
          reversed_by_user_id
        from maintenance_completions
        where id = $1 and house_id = $2
        for update
      `,
      [completionId, house.id]
    );
    const completion = completionResult.rows[0];

    if (!completion) {
      throw new ApiError(404, "completion_not_found", "Historikposten blev ikke fundet.");
    }
    if (completion.reversed_at) {
      throw new ApiError(409, "completion_already_reversed", "Historikposten er allerede lagt tilbage.");
    }

    const taskResult = await client.query<MaintenanceTaskRow>(
      `
        select ${maintenanceTaskReturningColumns()}
        from maintenance_tasks
        where id = $1 and house_id = $2
        for update
      `,
      [completion.task_id, house.id]
    );
    const task = taskResult.rows[0];

    if (!task || task.deleted_at || task.archived_at || task.status !== "done") {
      throw new ApiError(409, "original_task_not_reversible", "Den oprindelige opgave kan ikke lægges tilbage.");
    }

    const restoredNoteDraft = completion.note?.trim()
      ? completion.note.trim().slice(0, 1200)
      : null;
    const draft = noteHandling === "keep_as_draft" ? restoredNoteDraft : null;
    let removedGeneratedTaskId: string | null = null;

    if (completion.recurrence_interval) {
      const successorResult = await client.query<MaintenanceTaskRow>(
        `
          select ${maintenanceTaskReturningColumns()}
          from maintenance_tasks
          where generated_from_completion_id = $1
          for update
        `,
        [completion.id]
      );

      if (successorResult.rowCount !== 1) {
        throw new ApiError(
          409,
          "recurrence_lineage_missing",
          successorResult.rowCount === 0
            ? "Denne gentagelse blev oprettet før sporingen af næste opgave blev indført og kan derfor ikke lægges tilbage automatisk."
            : "Den automatisk oprettede næste opgave kan ikke identificeres entydigt."
        );
      }

      const successor = successorResult.rows[0] as MaintenanceTaskRow;
      if (successor.deleted_at || successor.archived_at || successor.status === "done" || successor.status === "dismissed") {
        throw new ApiError(409, successor.status === "done" ? "generated_task_completed" : "generated_task_missing", "Den næste opgave er ikke længere aktiv.");
      }
      if (!successor.generated_state_fingerprint) {
        throw new ApiError(409, "recurrence_lineage_missing", "Den næste opgaves integritetsdata mangler.");
      }

      const successorCompletion = await client.query<{ id: string }>(
        "select id from maintenance_completions where task_id = $1",
        [successor.id]
      );
      if (successorCompletion.rows[0]) {
        throw new ApiError(409, "generated_task_completed", "Den næste opgave er allerede fuldført.");
      }

      const successorChild = await client.query<{ id: string }>(
        "select id from maintenance_tasks where generated_from_completion_id = $1 limit 1",
        [successor.id]
      );
      if (successorChild.rows[0]) {
        throw new ApiError(409, "generated_task_has_successor", "Den næste opgave har allerede genereret en efterfølger.");
      }

      const currentFingerprint = maintenanceGeneratedTaskFingerprint(successor);
      if (currentFingerprint !== successor.generated_state_fingerprint) {
        throw new ApiError(409, "generated_task_changed", "Den næste opgave er blevet ændret og kan ikke fjernes automatisk.");
      }

      await client.query(
        "update maintenance_tasks set archived_at = now(), updated_at = now() where id = $1",
        [successor.id]
      );
      removedGeneratedTaskId = successor.id;
    }

    const restoredTaskResult = await client.query<MaintenanceTaskRow>(
      `
        update maintenance_tasks
        set status = 'planned', completed_at = null, restored_note_draft = $2, updated_at = now()
        where id = $1
        returning ${maintenanceTaskReturningColumns()}
      `,
      [task.id, draft]
    );

    await client.query(
      `
        update maintenance_completions
        set reversed_at = now(), reversed_by_user_id = $2
        where id = $1
      `,
      [completion.id, userId]
    );

    await client.query("commit");
    return {
      restoredTask: toMaintenanceTask(restoredTaskResult.rows[0] as MaintenanceTaskRow),
      reversedCompletionId: completion.id,
      removedGeneratedTaskId,
      restoredNoteDraft: draft
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
        c.source,
        c.recurrence_interval,
        c.recurrence_anchor,
        c.created_at
      from maintenance_completions c
      where c.id = $1 and c.house_id = $2 and c.reversed_at is null
    `,
    [completionId, house.id]
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
        where id = $1 and house_id = $2
      `,
      [recommendationId, house.id]
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
    "upload_status = 'uploaded'",
    "archived_at is null"
  ];
  const values: unknown[] = [house.id];

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
        title, category, document_type, document_date, related_party, amount_minor, currency,
        expires_at, is_important, note, analysis_status, analysis_version, analysis_requested_at,
        analysis_started_at, analysis_completed_at, analysis_error_code, detected_document_type, extracted_metadata,
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
    title?: string | null | undefined;
    category?: HouseDocument["category"] | undefined;
    documentType?: HouseDocument["documentType"] | undefined;
    documentDate?: string | null | undefined;
    relatedParty?: string | null | undefined;
    amountMinor?: number | null | undefined;
    expiresAt?: string | null | undefined;
    isImportant?: boolean | undefined;
    note?: string | null | undefined;
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
        storage_provider,
        title, category, document_type, document_date, related_party, amount_minor,
        expires_at, is_important, note
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      returning
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        title, category, document_type, document_date, related_party, amount_minor, currency,
        expires_at, is_important, note, analysis_status, analysis_version, analysis_requested_at,
        analysis_started_at, analysis_completed_at, analysis_error_code, detected_document_type, extracted_metadata,
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
      process.env.MATRIVA_STORAGE_ADAPTER === "local" ? "local" : "s3",
      input.title ?? null, input.category ?? null, input.documentType ?? null,
      input.documentDate ?? null, input.relatedParty ?? null, input.amountMinor ?? null,
      input.expiresAt ?? null, input.isImportant ?? false, input.note ?? null
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
        title, category, document_type, document_date, related_party, amount_minor, currency,
        expires_at, is_important, note, analysis_status, analysis_version, analysis_requested_at,
        analysis_started_at, analysis_completed_at, analysis_error_code, detected_document_type, extracted_metadata,
        created_at,
        updated_at
      from house_documents
      where id = $1
        and house_id = $2
        and upload_status = 'uploaded'
        and archived_at is null
    `,
    [documentId, house.id]
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
  const house = await getSavedHouse(userId, houseId);
  const { objectKey } = await getHouseDocumentForHouse(
    userId,
    houseId,
    documentId
  );
  const result = await pool.query<HouseDocumentRow>(
    `
      update house_documents
      set upload_status = 'archived', archived_at = now(), updated_at = now()
      where id = $1 and house_id = $2
      returning
        id,
        house_id,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        checksum_sha256,
        upload_status,
        title, category, document_type, document_date, related_party, amount_minor, currency,
        expires_at, is_important, note, analysis_status, analysis_version, analysis_requested_at,
        analysis_started_at, analysis_completed_at, analysis_error_code, detected_document_type, extracted_metadata,
        created_at,
        updated_at
    `,
    [documentId, house.id]
  );

  return {
    document: toHouseDocument(result.rows[0] as HouseDocumentRow),
    objectKey
  };
}

export async function updateHouseDocumentForHouse(
  userId: string,
  houseId: string,
  documentId: string,
  input: {
    title?: string | null | undefined;
    category?: HouseDocument["category"] | undefined;
    documentType?: HouseDocument["documentType"] | undefined;
    documentDate?: string | null | undefined;
    relatedParty?: string | null | undefined;
    amountMinor?: number | null | undefined;
    expiresAt?: string | null | undefined;
    isImportant?: boolean | undefined;
    note?: string | null | undefined;
  }
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseDocumentRow>(
    `update house_documents set
      title = case when $4::boolean then $5::text else title end,
      category = case when $6::boolean then $7::text else category end,
      document_type = case when $8::boolean then $9::text else document_type end,
      document_date = case when $10::boolean then $11::date else document_date end,
      related_party = case when $12::boolean then $13::text else related_party end,
      amount_minor = case when $14::boolean then $15::integer else amount_minor end,
      expires_at = case when $16::boolean then $17::date else expires_at end,
      is_important = case when $18::boolean then $19::boolean else is_important end,
      note = case when $20::boolean then $21::text else note end,
      updated_at = now()
      where id = $1 and house_id = $2 and upload_status = 'uploaded' and archived_at is null
      returning id, house_id, object_key, original_filename, mime_type, size_bytes, checksum_sha256, upload_status,
        title, category, document_type, document_date, related_party, amount_minor, currency, expires_at, is_important, note,
        analysis_status, analysis_version, analysis_requested_at, analysis_started_at, analysis_completed_at, analysis_error_code,
        detected_document_type, extracted_metadata, created_at, updated_at`,
    [
      documentId,
      house.id,
      userId,
      input.title !== undefined,
      input.title ?? null,
      input.category !== undefined,
      input.category ?? null,
      input.documentType !== undefined,
      input.documentType ?? null,
      input.documentDate !== undefined,
      input.documentDate ?? null,
      input.relatedParty !== undefined,
      input.relatedParty ?? null,
      input.amountMinor !== undefined,
      input.amountMinor ?? null,
      input.expiresAt !== undefined,
      input.expiresAt ?? null,
      input.isImportant !== undefined,
      input.isImportant ?? null,
      input.note !== undefined,
      input.note ?? null
    ]
  );
  if (!result.rows[0]) throw new ApiError(404, "house_document_not_found", "Dokumentet blev ikke fundet.");
  return toHouseDocument(result.rows[0]);
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
  const result = await pool.query<HouseImprovementRow>(`${improvementSelect} order by i.completed_date desc, i.created_at desc`, [house.id]);
  return result.rows.map(toHouseImprovement);
}

const improvementSelect = `select i.*, to_char(i.completed_date, 'YYYY-MM-DD') as completed_date,
  (select count(*) from house_improvement_documents d where d.improvement_id = i.id) as document_count
  from house_improvements i where i.house_id = $1 and i.archived_at is null`;

async function requireImprovement(userId: string, houseId: string, improvementId: string) {
  await getSavedHouse(userId, houseId);
  const result = await pool.query<HouseImprovementRow>(`${improvementSelect} and i.id = $2`, [houseId, improvementId]);
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "improvement_not_found", "Forbedringen blev ikke fundet.");
  return row;
}

export async function getHouseImprovement(userId: string, houseId: string, improvementId: string) {
  const row = await requireImprovement(userId, houseId, improvementId);
  const documents = await pool.query(`select d.* from house_documents d join house_improvement_documents r on r.document_id=d.id and r.house_id=d.house_id where r.improvement_id=$1 and d.archived_at is null order by r.created_at desc`, [improvementId]);
  return { ...toHouseImprovement(row), documents: documents.rows.map(toHouseDocument) };
}

export async function createHouseImprovement(
  userId: string,
  houseId: string,
  input: CreateHouseImprovementRequest
) {
  const house = await getSavedHouse(userId, houseId);
  const result = await pool.query(`insert into house_improvements (id,house_id,user_id,title,description,category,completed_date,total_amount_minor) values ($1,$2,$3,$4,$5,$6,$7::date,$8) returning id`, [createOpaqueId("impr"), house.id, userId, input.title.trim(), input.description?.trim() || null, input.category, input.completedDate, input.totalAmountMinor ?? null]);
  return getHouseImprovement(userId, houseId, result.rows[0].id);
}

export async function updateHouseImprovement(userId: string, houseId: string, improvementId: string, input: UpdateHouseImprovementRequest) {
  await requireImprovement(userId, houseId, improvementId);
  const fields: string[] = []; const values: unknown[] = [];
  for (const [key, column] of [["title","title"],["description","description"],["category","category"],["completedDate","completed_date"],["totalAmountMinor","total_amount_minor"]] as const) if (key in input) { const raw = (input as any)[key]; values.push(raw ?? null); fields.push(`${column}=$${values.length}${column.endsWith("date") ? "::date" : ""}`); }
  if (fields.length) { values.push(improvementId, houseId); await pool.query(`update house_improvements set ${fields.join(",")}, updated_at=now() where id=$${values.length-1} and house_id=$${values.length}`, values); }
  return getHouseImprovement(userId, houseId, improvementId);
}
export async function archiveHouseImprovement(userId: string, houseId: string, improvementId: string) { await requireImprovement(userId, houseId, improvementId); await pool.query(`update house_improvements set archived_at=now(), updated_at=now() where id=$1 and house_id=$2`, [improvementId,houseId]); }
export async function createHouseImprovementDocumentRelation(userId:string,houseId:string,improvementId:string,input:AttachHouseImprovementDocumentRequest){await requireImprovement(userId,houseId,improvementId);const r=await pool.query(`select 1 from house_documents where id=$1 and house_id=$2 and archived_at is null`,[input.documentId,houseId]);if(!r.rowCount)throw new ApiError(404,'house_document_not_found','Dokumentet blev ikke fundet.');await pool.query(`insert into house_improvement_documents(improvement_id,house_id,user_id,document_id) values($1,$2,$3,$4) on conflict do nothing`,[improvementId,houseId,userId,input.documentId]);return getHouseImprovement(userId,houseId,improvementId);}
export async function deleteHouseImprovementDocumentRelation(userId:string,houseId:string,improvementId:string,documentId:string){await requireImprovement(userId,houseId,improvementId);await pool.query(`delete from house_improvement_documents where improvement_id=$1 and house_id=$2 and document_id=$3`,[improvementId,houseId,documentId]);}

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
      where house_id = $1 and is_current_house_photo
      order by created_at desc
      limit 1
    `,
    [house.id]
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
        where house_id = $1 and is_current_house_photo
      `,
      [house.id]
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
      where house_id = $1 and is_current_house_photo
    `,
    [house.id]
  );
}

export async function buildAppBootstrap(userId: string): Promise<AppBootstrapResponse> {
  const [user, profile, houses, pendingClaims, ownerPendingClaims, pendingInvitations] = await Promise.all([
    getUserById(userId),
    getProfileForUser(userId),
    listSavedHouses(userId),
    pool.query(
      `select c.id, c.house_id, h.address_label, h.bfe_number, c.claim_type, c.status, c.requested_at
       from house_claims c
       join houses h on h.id = c.house_id
       where c.user_id = $1 and c.status = 'pending'
       order by c.requested_at desc`,
      [userId]
    ),
    pool.query(
      `select c.id, c.house_id, c.claim_type, c.status, c.requested_at,
              h.address_label, h.bfe_number,
              coalesce(requester_profile.display_name, requester.email) as requester_name,
              requester.email as requester_email
       from house_claims c
       join houses h on h.id = c.house_id
       join users requester on requester.id = c.user_id
       left join user_profiles requester_profile on requester_profile.user_id = requester.id
       where c.status = 'pending'
         and exists (select 1 from house_memberships owner_membership where owner_membership.house_id = c.house_id and owner_membership.user_id = $1 and owner_membership.role = 'owner' and owner_membership.status = 'active')
       order by c.requested_at desc`,
      [userId]
    ),
    pool.query(
      `select i.id, i.house_id, i.email, i.role, i.status, i.expires_at,
              h.address_label, h.bfe_number,
              coalesce(inviter_profile.display_name, inviter.email) as inviter_name
       from house_invitations i
       join houses h on h.id = i.house_id
       join users invited_user on invited_user.id = $1 and lower(invited_user.email) = lower(i.email)
       join users inviter on inviter.id = i.invited_by_user_id
       left join user_profiles inviter_profile on inviter_profile.user_id = inviter.id
       where i.status = 'pending' and i.expires_at > now()
       order by i.created_at desc`,
      [userId]
    )
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
    activeHouseId: profile.defaultHouseId && houses.some((house) => house.id === profile.defaultHouseId)
      ? profile.defaultHouseId
      : houses.length === 1
        ? houses[0]?.id ?? null
        : null,
    pendingHouseClaims: pendingClaims.rows.map((claim) => ({
      id: claim.id,
      houseId: claim.house_id,
      addressLabel: claim.address_label,
      bfeNumber: claim.bfe_number,
      claimType: claim.claim_type,
      status: claim.status,
      requestedAt: new Date(claim.requested_at).toISOString()
    })),
    ownerPendingHouseClaims: ownerPendingClaims.rows.map((claim) => ({
      id: claim.id,
      houseId: claim.house_id,
      requesterName: claim.requester_name,
      requesterEmail: claim.requester_email,
      addressLabel: claim.address_label,
      bfeNumber: claim.bfe_number,
      claimType: claim.claim_type,
      status: claim.status,
      requestedAt: new Date(claim.requested_at).toISOString()
    })),
    pendingHouseInvitations: pendingInvitations.rows.map((invitation) => ({
      id: invitation.id,
      houseId: invitation.house_id,
      addressLabel: invitation.address_label,
      bfeNumber: invitation.bfe_number,
      email: invitation.email,
      inviterName: invitation.inviter_name,
      role: invitation.role,
      status: invitation.status,
      expiresAt: new Date(invitation.expires_at).toISOString()
    })),
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
