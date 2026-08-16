import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addressSearchQuerySchema,
  addressSearchResponseSchema,
  adminBootstrapResponseSchema,
  adminEntitlementConfigResponseSchema,
  adminUserEntitlementResponseSchema,
  updateAdminEntitlementPlanConfigRequestSchema,
  updateAdminUserEntitlementRequestSchema,
  adminDashboardPeriodKeySchema,
  adminDashboardResponseSchema,
  adminHouseResponseSchema,
  adminHousesResponseSchema,
  adminHouseClaimsResponseSchema,
  adminHouseClaimStatusFilterSchema,
  adminHouseInvitationsResponseSchema,
  adminHouseInvitationStatusFilterSchema,
  adminRecommendationCatalogItemResponseSchema,
  adminRecommendationCatalogResponseSchema,
  updateAdminRecommendationGuideRequestSchema,
  adminTaskClusterResponseSchema,
  adminTaskClustersResponseSchema,
  correctAdminTaskClusterTaskRequestSchema,
  mergeAdminTaskClustersRequestSchema,
  splitAdminTaskClusterRequestSchema,
  updateAdminTaskClusterRequestSchema,
  adminGuideResponseSchema,
  adminGuidesResponseSchema,
  guideAuditResponseSchema,
  guideResponseSchema,
  guidesResponseSchema,
  guideOpenRequestSchema,
  guideStatusFilterSchema,
  guideStatusUpdateRequestSchema,
  adminPasswordLoginRequestSchema,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  apiErrorSchema,
  appBootstrapResponseSchema,
  authSessionResponseSchema,
  consumeMagicLinkRequestSchema,
  currentUserResponseSchema,
  createHouseImprovementRequestSchema,
  updateHouseImprovementRequestSchema,
  attachHouseImprovementDocumentRequestSchema,
  createMaintenanceTaskRequestSchema,
  acceptMaintenanceRecommendationRequestSchema,
  completeMaintenanceTaskRequestSchema,
  dismissMaintenanceRecommendationRequestSchema,
  dismissMaintenanceRecommendationResponseSchema,
  maintenanceRecommendationStatusSchema,
  createSavedHouseRequestSchema,
  enrichHouseDraftRequestSchema,
  enrichHouseDraftResponseSchema,
  healthResponseSchema,
  houseImprovementResponseSchema,
  houseImprovementsResponseSchema,
  housePhotoResponseSchema,
  housePublicDataResponseV1Schema,
  housePublicDataWithProfileResponseV1Schema,
  houseDraftIdSchema,
  houseDraftOverviewPreviewResponseSchema,
  houseDraftResponseSchema,
  houseIdSchema,
  improvementIdSchema,
  homeBootstrapResponseSchema,
  maintenanceTaskResponseSchema,
  maintenanceHistoryResponseSchema,
  maintenanceHistoryDetailResponseSchema,
  maintenanceRecommendationsResponseSchema,
  maintenanceCatalogResponseSchema,
  houseFactsResponseSchema,
  upsertHouseFactRequestSchema,
  upsertHouseComponentRequestSchema,
  houseDocumentsResponseSchema,
  houseDocumentResponseSchema,
  logoutRequestSchema,
  logoutResponseSchema,
  maintenanceTasksResponseSchema,
  maintenanceRecommendationIdSchema,
  maintenanceCompletionIdSchema,
  documentIdSchema,
  moveMaintenanceTaskRequestSchema,
  refreshSessionRequestSchema,
  requestMagicLinkRequestSchema,
  requestMagicLinkResponseSchema,
  savedHouseResponseSchema,
  savedHousesResponseSchema,
  selectedAddressInputSchema,
  taskIdSchema,
  uploadHousePhotoRequestSchema,
  uploadHouseDocumentRequestSchema,
  updateHouseDocumentRequestSchema,
  updateProfileRequestSchema,
  updateProfileResponseSchema,
  updateMaintenanceSettingsRequestSchema,
  updateMaintenanceSettingsResponseSchema,
  updateDefaultHouseRequestSchema,
  updateDefaultHouseResponseSchema,
  updateMaintenanceTaskRequestSchema,
  updateMaintenanceTaskStatusRequestSchema,
  houseDocumentCategoryForType,
  maintenanceHistoryQuerySchema,
  reverseMaintenanceCompletionRequestSchema,
  reverseMaintenanceCompletionResponseSchema
} from "@matriva/shared";

import type { AppCompatibility } from "@matriva/shared";

import { requireAdminUser, toAdminBootstrapResponse } from "./admin.ts";
import { getAdminDashboard } from "./admin-dashboard.ts";
import { getAdminHouse, listAdminHouses } from "./admin-houses.ts";
import {
  correctAdminTaskClusterTask,
  getAdminTaskCluster,
  listAdminTaskClusters,
  mergeAdminTaskClusters,
  splitAdminTaskCluster,
  updateAdminTaskCluster
} from "./admin-task-clusters.ts";
import {
  getAdminRecommendationCatalogItem,
  listAdminRecommendationCatalog,
  updateAdminRecommendationGuide
} from "./admin-recommendations.ts";
import { getAdminUser, listAdminUsers } from "./admin-users.ts";
import { loginAdminWithPassword } from "./auth/admin-password.ts";
import { sendMagicLinkEmail, createMagicLinkUrl, createHouseInvitationUrl, sendHouseInvitationEmail, createHouseClaimApprovalUrl, sendHouseClaimOwnerEmail } from "./auth/mailer.ts";
import { getDatafordelerConfigStatus } from "./config/datafordeler.ts";
import { storageMode, validateStorageConfiguration } from "./storage-config.ts";
import {
  guideAssetDeliveryPlan,
  readGuideAssetWithFallback
} from "./guide-asset-delivery.ts";
import { DatafordelerClient, DatafordelerProviderError } from "./public-data/datafordeler-client.ts";
import {
  evaluateMobileCompatibility,
  mobileAppBuildHeader,
  mobileAppVersionHeader,
  mobileClientIdentityFromHeaders,
  mobileCompatibilityPolicyFromEnvironment
} from "./mobile-compatibility.ts";
import {
  ApiError,
  authenticateAccessToken,
  authPublicResponse,
  buildAppBootstrap,
  getAdminUserEntitlements,
  getAdminGuide,
  getGuideAsset,
  getPublishedGuide,
  recordGuideOpen,
  listAdminGuides,
  listRuntimeGuides,
  listAdminEntitlementConfigs,
  updateAdminEntitlementPlanConfig,
  acceptMaintenanceRecommendationForHouse,
  archiveMaintenanceTaskForHouse,
  archiveHouseDocumentForHouse,
  completeMaintenanceTaskForHouse,
  reverseMaintenanceCompletionForHouse,
  countActiveDocumentObjectReferences,
  consumeMagicLinkToken,
  createHouseDocumentForHouse,
  createHouseImprovement,
  getHouseImprovement,
  updateHouseImprovement,
  archiveHouseImprovement,
  createHouseImprovementDocumentRelation,
  deleteHouseImprovementDocumentRelation,
  createMaintenanceTaskForHouse,
  createMagicLinkToken,
  createSavedHouse,
  findHouseByBfe,
  hasActiveHouseMembership,
  createHouseClaim,
  approveHouseClaimByOwnerToken,
  resolveHouseClaimByOwner,
  listHouseMembers,
  revokeHouseMembership,
  createHouseInvitation,
  revokeHouseInvitation,
  acceptHouseInvitation,
  acceptHouseInvitationById,
  resolveHouseClaim,
  getProfileForUser,
  getCurrentHousePhoto,
  getSavedHouse,
  getMaintenanceTaskForHouse,
  getHouseDocumentForHouse,
  updateHouseDocumentForHouse,
  getMaintenanceHistoryEntryForHouse,
  getUserById,
  listHouseDocumentsForHouse,
  listMaintenanceHistoryForHouse,
  listMaintenanceRecommendationsForHouse,
  listMaintenanceCatalogForHouse,
  getHouseFactsForHouse,
  upsertHouseFactForHouse,
  upsertHouseComponentForHouse,
  listMaintenanceTasksForHouse,
  listHouseImprovements,
  listSavedHouses,
  logoutSession,
  migrateDatabase,
  refreshSession,
  removeHousePhoto,
  replaceHousePhoto,
  dismissMaintenanceRecommendationForHouse,
  restoreMaintenanceRecommendationForHouse,
  moveMaintenanceTaskForHouse,
  updateMaintenanceTaskForHouse,
  updateMaintenanceTaskStatus,
  updateProfile,
  updateMaintenanceSettings,
  updateDefaultHouse,
  updateAdminUserEntitlement,
  updateGuideStatus,
  pool,
  validateAuthRuntimeConfig
} from "./db.ts";
import {
  getHousePublicData,
  getHousePublicDataProfile,
  getHousePublicDataSummaries,
  refreshHousePublicData,
  refreshHousePublicDataProfile,
  startHousePublicDataRefreshAfterHouseCreated
} from "./public-data/service.ts";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const dawaAddressSearchUrl = "https://api.dataforsyningen.dk/adresser";
const dawaTimeoutMs = 2500;
const localObjectStorageRoot =
  process.env.MATRIVA_ATTACHMENT_STORAGE_DIR ??
  process.env.MATRIVA_OBJECT_STORAGE_DIR ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "var", "objects");
const documentMaxBytes = Number.parseInt(
  process.env.MATRIVA_DOCUMENT_MAX_BYTES ??
    process.env.MATRIVA_MAINTENANCE_ATTACHMENT_MAX_BYTES ??
    `${15 * 1024 * 1024}`,
  10
);
const defaultAdminAllowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://admin.matriva.dk"
];
const configuredAdminAllowedOrigins = (
  process.env.MATRIVA_ADMIN_ALLOWED_ORIGINS ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const adminAllowedOrigins = new Set([
  ...defaultAdminAllowedOrigins,
  ...configuredAdminAllowedOrigins
]);

type DawaAddress = {
  id?: unknown;
  adressebetegnelse?: unknown;
  etage?: unknown;
  dør?: unknown;
  adgangsadresse?: {
    id?: unknown;
    vejstykke?: {
      navn?: unknown;
      adresseringsnavn?: unknown;
    };
    husnr?: unknown;
    postnummer?: {
      nr?: unknown;
      navn?: unknown;
    };
  };
};

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function writeBinary(
  response: ServerResponse,
  status: number,
  body: Buffer,
  contentType: string,
  options: { cacheControl: string; variant: boolean } = {
    cacheControl: "private, no-store",
    variant: false
  }
) {
  response.writeHead(status, {
    "content-type": contentType,
    "content-length": body.byteLength,
    "cache-control": options.cacheControl,
    "etag": `\"${sha256Hex(body)}\"`,
    ...(options.variant ? { "x-matriva-asset-variant": "webp" } : {})
  });
  response.end(body);
}

function writeApiError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  details?: {
    feature?: string;
    limit?: number | null;
    current?: number;
    storageLimitBytes?: number | null;
    storageBytes?: number;
    compatibility?: AppCompatibility;
  }
) {
  writeJson(
    response,
    status,
    apiErrorSchema.parse({
      code,
      message,
      ...(details ? { details } : {})
    })
  );
}

function applyCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;

  if (!origin || Array.isArray(origin) || !adminAllowedOrigins.has(origin)) {
    return;
  }

  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    `authorization,content-type,x-matriva-guide-preview,${mobileAppVersionHeader},${mobileAppBuildHeader}`
  );
  response.setHeader("access-control-max-age", "600");
}


function getBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim();
}

async function requireUserId(request: IncomingMessage) {
  return authenticateAccessToken(getBearerToken(request));
}

function guideDraftPreviewEnabled(request: IncomingMessage) {
  const environment = (process.env.MATRIVA_ENVIRONMENT ?? process.env.NODE_ENV ?? "local").toLowerCase();
  return (
    process.env.MATRIVA_GUIDE_PREVIEW_ENABLED === "true" &&
    ["local", "development", "qa"].includes(environment) &&
    request.headers["x-matriva-guide-preview"] === "true"
  );
}

function requestIpHash(request: IncomingMessage) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0] ?? request.socket.remoteAddress;

  if (!rawIp) {
    return undefined;
  }

  return createHash("sha256").update(rawIp).digest("hex");
}

function userAgentHint(request: IncomingMessage) {
  const userAgent = request.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}

function writeUnknownApiError(response: ServerResponse, error: unknown) {
  if (error instanceof ApiError) {
    writeApiError(response, error.status, error.code, error.message, error.details);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(JSON.stringify({
      event: "api.unhandled_error",
      message: error instanceof Error ? error.message : String(error)
    }));
  }

  writeApiError(
    response,
    500,
    "api_internal_error",
    "The Matriva API could not complete the request."
  );
}

function devUrlsForHost(bindHost: string, bindPort: number) {
  const localUrl = `http://127.0.0.1:${bindPort}`;
  const androidEmulatorUrl = `http://10.0.2.2:${bindPort}`;

  return {
    bind: `http://${bindHost}:${bindPort}`,
    local: localUrl,
    iosSimulator: localUrl,
    androidEmulator: androidEmulatorUrl,
    physicalDevice: `http://<mac-lan-ip>:${bindPort}`
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createAddressSuggestionId(): `addr_${string}` {
  return `addr_${randomBytes(10).toString("hex")}`;
}

function createHouseDraftId(): `house_draft_${string}` {
  return `house_draft_${randomBytes(10).toString("hex")}`;
}

function createHomeCardId(): `card_${string}` {
  return `card_${randomBytes(10).toString("hex")}`;
}

function createOverviewPreviewCardId(): `overview_card_${string}` {
  return `overview_card_${randomBytes(10).toString("hex")}`;
}

function createDateOnlyDaysFromNow(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function extractPostalCodeAndCity(label: string) {
  const match = /,\s*(\d{4})\s+([^,]+)$/.exec(label);

  if (!match) {
    return {};
  }

  return {
    postalCode: match[1],
    city: match[2]?.trim()
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function mediaExtension(mimeType: string) {
  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/heic") {
    return ".heic";
  }

  if (mimeType === "image/heif") {
    return ".heif";
  }

  return ".jpg";
}

function storageEnvironmentPrefix() {
  const configuredEnvironment =
    process.env.MATRIVA_ENVIRONMENT ?? process.env.NODE_ENV ?? "local";
  const normalizedEnvironment = configuredEnvironment
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  return normalizedEnvironment || "local";
}

function mediaStorageKey(houseId: string, mimeType: string) {
  return join(
    storageEnvironmentPrefix(),
    "houses",
    houseId,
    "photos",
    `${Date.now()}-${randomBytes(8).toString("hex")}${mediaExtension(mimeType)}`
  );
}

function objectExtension(mimeType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf"
  };

  return extensions[mimeType] ?? ".bin";
}

function documentObjectKey(houseId: string, mimeType: string) {
  return [
    storageEnvironmentPrefix(),
    "houses",
    houseId,
    "documents",
    `${randomBytes(18).toString("hex")}${objectExtension(mimeType)}`
  ].join("/");
}

function objectStoragePath(objectKey: string) {
  const normalized = objectKey.replace(/^[/\\]+/, "");

  if (normalized.includes("..") || extname(normalized).length === 0) {
    throw new ApiError(400, "storage_object_key_invalid", "Dokumentets object key er ugyldig.");
  }

  return join(localObjectStorageRoot, normalized);
}

function sha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function s3Config() {
  const endpoint = process.env.MATRIVA_S3_ENDPOINT;
  const bucket = process.env.MATRIVA_S3_BUCKET;
  const accessKeyId = process.env.MATRIVA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.MATRIVA_S3_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new ApiError(503, "storage_unconfigured", "Filarkivet er ikke konfigureret.");
  }

  return {
    endpoint: endpoint.replace(/\/$/, ""),
    bucket,
    region: process.env.MATRIVA_S3_REGION ?? "eu-central",
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.MATRIVA_S3_FORCE_PATH_STYLE !== "false"
  };
}

function s3RequestUrl(objectKey: string) {
  const config = s3Config();
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");

  if (config.forcePathStyle) {
    return new URL(`${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`);
  }

  const endpoint = new URL(config.endpoint);
  return new URL(`${endpoint.protocol}//${config.bucket}.${endpoint.host}/${encodedKey}`);
}

function s3SignedHeaders(method: string, url: URL, body: Buffer, contentType?: string) {
  const config = s3Config();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate
  };

  if (contentType) {
    headers["content-type"] = contentType;
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]}`)
    .join("\n");
  const canonicalRequest = [
    method,
    url.pathname,
    url.searchParams.toString(),
    `${canonicalHeaders}\n`,
    signedHeaderNames.join(";"),
    payloadHash
  ].join("\n");
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...headers,
    authorization: [
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}`,
      `SignedHeaders=${signedHeaderNames.join(";")}`,
      `Signature=${signature}`
    ].join(", ")
  };
}

async function writeStorageObject(objectKey: string, content: Buffer, mimeType: string) {
  if (storageMode() === "local") {
    const path = objectStoragePath(objectKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: "wx" });
    return;
  }

  const url = s3RequestUrl(objectKey);
  const response = await fetch(url, {
    method: "PUT",
    headers: s3SignedHeaders("PUT", url, content, mimeType),
    body: content
  });

  if (!response.ok) {
    throw new ApiError(502, "storage_upload_failed", "Upload til filarkivet fejlede.");
  }
}

async function readStorageObject(objectKey: string, mimeType: string) {
  if (storageMode() === "local") {
    return readFile(objectStoragePath(objectKey));
  }

  const empty = Buffer.alloc(0);
  const url = s3RequestUrl(objectKey);
  const response = await fetch(url, {
    method: "GET",
    headers: s3SignedHeaders("GET", url, empty, mimeType)
  });

  if (!response.ok) {
    throw new ApiError(404, "storage_object_not_found", "Filen blev ikke fundet i filarkivet.");
  }

  return Buffer.from(await response.arrayBuffer());
}

async function deleteStorageObject(objectKey: string) {
  if (storageMode() === "local") {
    try {
      await unlink(objectStoragePath(objectKey));
    } catch {
      // Metadata has already been archived; missing local objects are safe to ignore.
    }
    return;
  }

  const empty = Buffer.alloc(0);
  const url = s3RequestUrl(objectKey);
  const response = await fetch(url, {
    method: "DELETE",
    headers: s3SignedHeaders("DELETE", url, empty)
  });

  if (!response.ok && response.status !== 404) {
    console.error(JSON.stringify({ event: "storage.object_delete_failed" }));
  }
}

function validateDocumentBytes(content: Buffer, mimeType: string, declaredSize: number) {
  if (content.byteLength === 0) {
    throw new ApiError(400, "document_empty", "Filen er tom.");
  }

  if (content.byteLength !== declaredSize) {
    throw new ApiError(400, "document_size_mismatch", "Filens størrelse matcher ikke uploaden.");
  }

  if (content.byteLength > documentMaxBytes) {
    throw new ApiError(400, "document_too_large", "Filen er for stor.");
  }

  const header = content.subarray(0, 12);
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPdf = header.subarray(0, 4).toString("utf8") === "%PDF";
  const brand = header.subarray(4, 12).toString("latin1");
  const isHeif = brand === "ftypheic" || brand === "ftypheif" || brand === "ftypmif1";

  if (mimeType === "image/png" && !isPng) {
    throw new ApiError(400, "document_type_mismatch", "PNG-filen kunne ikke valideres.");
  }

  if (mimeType === "image/jpeg" && !isJpeg) {
    throw new ApiError(400, "document_type_mismatch", "JPEG-filen kunne ikke valideres.");
  }

  if (mimeType === "application/pdf" && !isPdf) {
    throw new ApiError(400, "document_type_mismatch", "PDF-filen kunne ikke valideres.");
  }

  if ((mimeType === "image/heic" || mimeType === "image/heif") && !isHeif) {
    throw new ApiError(400, "document_type_mismatch", "HEIC/HEIF-filen kunne ikke valideres.");
  }
}

async function fetchDawaAddresses(query: string): Promise<DawaAddress[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dawaTimeoutMs);
  const url = new URL(dawaAddressSearchUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("per_side", "5");

  try {
    const dawaResponse = await fetch(url, { signal: controller.signal });

    if (!dawaResponse.ok) {
      throw new Error(`DAWA request failed with status ${dawaResponse.status}`);
    }

    const payload: unknown = await dawaResponse.json();

    if (!Array.isArray(payload)) {
      throw new Error("DAWA response was not an array");
    }

    return payload.filter(
      (item): item is DawaAddress =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  } finally {
    clearTimeout(timeout);
  }
}

const server = createServer((request, response) => {
  applyCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    const body = healthResponseSchema.parse({
      status: "ok",
      service: "matriva-api",
      timestamp: new Date().toISOString()
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/admin/auth/login") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = adminPasswordLoginRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(response, 401, "admin_login_invalid", "E-mail eller password er forkert.");
          return;
        }

        const ipHash = requestIpHash(request);
        const session = await loginAdminWithPassword({
          ...parsedRequest.data,
          ...(ipHash ? { ipHash } : {})
        });
        writeJson(response, 200, authSessionResponseSchema.parse(session));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/admin/bootstrap") {
    void (async () => {
      try {
        const principal = await requireAdminUser(getBearerToken(request));
        writeJson(
          response,
          200,
          adminBootstrapResponseSchema.parse(
            toAdminBootstrapResponse(principal)
          )
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/guides" || request.url?.startsWith("/v1/admin/guides?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const parsedFilter = guideStatusFilterSchema.safeParse(url.searchParams.get("status") ?? "all");
        if (!parsedFilter.success) {
          writeApiError(response, 400, "guide_status_filter_invalid", "Guide-statusfilteret er ugyldigt.");
          return;
        }
        writeJson(response, 200, adminGuidesResponseSchema.parse(await listAdminGuides(parsedFilter.data)));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminGuideMatch = /^\/v1\/admin\/guides\/([^/?]+)$/.exec((request.url ?? "").split("?")[0] ?? "");
  if (request.method === "GET" && adminGuideMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        writeJson(response, 200, adminGuideResponseSchema.parse(await getAdminGuide(decodeURIComponent(adminGuideMatch[1]!))));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PATCH" && adminGuideMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = guideStatusUpdateRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "guide_status_update_invalid", "Guide-status er ugyldig.");
          return;
        }
        writeJson(response, 200, adminGuideResponseSchema.parse(await updateGuideStatus(admin.userId, decodeURIComponent(adminGuideMatch[1]!), parsed.data)));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminGuideAuditMatch = /^\/v1\/admin\/guides\/([^/?]+)\/audit$/.exec((request.url ?? "").split("?")[0] ?? "");
  if (request.method === "GET" && adminGuideAuditMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const detail = await getAdminGuide(decodeURIComponent(adminGuideAuditMatch[1]!));
        writeJson(response, 200, guideAuditResponseSchema.parse({ audit: detail.audit, generatedAt: new Date().toISOString() }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/guides") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const guides = await listRuntimeGuides(guideDraftPreviewEnabled(request) && Boolean(userId));
        writeJson(response, 200, guidesResponseSchema.parse({ guides, generatedAt: new Date().toISOString() }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const guideMatch = /^\/v1\/guides\/([^/?]+)$/.exec((request.url ?? "").split("?")[0] ?? "");
  const guideOpenMatch = /^\/v1\/guides\/([^/?]+)\/open$/.exec((request.url ?? "").split("?")[0] ?? "");
  if (request.method === "POST" && guideOpenMatch) {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const parsed = guideOpenRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "guide_open_invalid", "Vejledningsåbningen er ugyldig.");
          return;
        }
        await recordGuideOpen(decodeURIComponent(guideOpenMatch[1]!), parsed.data.versionId, guideDraftPreviewEnabled(request) && Boolean(userId));
        writeJson(response, 200, { ok: true });
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && guideMatch) {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const guide = await getPublishedGuide(decodeURIComponent(guideMatch[1]!), guideDraftPreviewEnabled(request) && Boolean(userId));
        writeJson(response, 200, guideResponseSchema.parse(guide));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const guideAssetMatch = /^\/v1\/guides\/assets\/([^/?]+)$/.exec((request.url ?? "").split("?")[0] ?? "");
  if (request.method === "GET" && guideAssetMatch) {
    void (async () => {
      try {
        const asset = await getGuideAsset(decodeURIComponent(guideAssetMatch[1]!));
        if (!asset.is_published) {
          try {
            await requireAdminUser(getBearerToken(request));
          } catch {
            const userId = await requireUserId(request);
            if (!userId || !guideDraftPreviewEnabled(request)) {
              throw new ApiError(404, "guide_asset_not_found", "Vejledningsbilledet blev ikke fundet.");
            }
          }
        }
        const delivery = await readGuideAssetWithFallback({
          plan: guideAssetDeliveryPlan({
            storageKey: asset.storage_key,
            checksumSha256: asset.checksum_sha256,
            mimeType: asset.mime_type,
            preferredWidth: asset.delivery_width
          }),
          original: { key: asset.storage_key, mimeType: asset.mime_type },
          read: readStorageObject
        });
        writeBinary(response, 200, delivery.content, delivery.mimeType, {
          cacheControl: "private, max-age=31536000, immutable",
          variant: delivery.variant
        });
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/dashboard" ||
      request.url?.startsWith("/v1/admin/dashboard?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const parsedPeriod = adminDashboardPeriodKeySchema.safeParse(
          url.searchParams.get("period") ?? "30d"
        );

        if (!parsedPeriod.success) {
          writeApiError(
            response,
            400,
            "admin_dashboard_period_invalid",
            "Dashboard period must be one of 7d, 30d, 90d, or 365d."
          );
          return;
        }

        const dashboard = await getAdminDashboard(parsedPeriod.data);
        writeJson(response, 200, adminDashboardResponseSchema.parse(dashboard));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/users" ||
      request.url?.startsWith("/v1/admin/users?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const users = await listAdminUsers(url.searchParams);
        writeJson(response, 200, adminUsersResponseSchema.parse(users));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/task-clusters" ||
      request.url?.startsWith("/v1/admin/task-clusters?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const clusters = await listAdminTaskClusters(url.searchParams);
        writeJson(response, 200, adminTaskClustersResponseSchema.parse(clusters));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminTaskClusterTaskMatch = /^\/v1\/admin\/task-clusters\/tasks\/([^/?]+)$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "PATCH" && adminTaskClusterTaskMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = correctAdminTaskClusterTaskRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "admin_task_cluster_correction_invalid", "Klassifikationskorrektionen er ugyldig.");
          return;
        }
        const result = await correctAdminTaskClusterTask(decodeURIComponent(adminTaskClusterTaskMatch[1]!), parsed.data.clusterId, admin.userId);
        writeJson(response, 200, result);
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/admin/task-clusters/merge") {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = mergeAdminTaskClustersRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "admin_task_cluster_merge_invalid", "Merge-inputtet er ugyldigt.");
          return;
        }
        const result = await mergeAdminTaskClusters(parsed.data.sourceClusterIds, parsed.data.targetClusterId, admin.userId);
        writeJson(response, 200, adminTaskClusterResponseSchema.parse(result));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/admin/task-clusters/split") {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = splitAdminTaskClusterRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "admin_task_cluster_split_invalid", "Split-inputtet er ugyldigt.");
          return;
        }
        const result = await splitAdminTaskCluster(parsed.data.clusterId, parsed.data.taskIds, parsed.data.taskType, admin.userId);
        writeJson(response, 200, adminTaskClusterResponseSchema.parse(result));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminTaskClusterMatch = /^\/v1\/admin\/task-clusters\/([^/?]+)$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "GET" && adminTaskClusterMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const result = await getAdminTaskCluster(decodeURIComponent(adminTaskClusterMatch[1]!));
        writeJson(response, 200, adminTaskClusterResponseSchema.parse(result));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PATCH" && adminTaskClusterMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = updateAdminTaskClusterRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "admin_task_cluster_update_invalid", "Clusterændringen er ugyldig.");
          return;
        }
        const result = await updateAdminTaskCluster(decodeURIComponent(adminTaskClusterMatch[1]!), parsed.data, admin.userId);
        writeJson(response, 200, adminTaskClusterResponseSchema.parse(result));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminUserMatch = /^\/v1\/admin\/users\/([^/?]+)$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "GET" && adminUserMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const user = await getAdminUser(decodeURIComponent(adminUserMatch[1]!));
        writeJson(response, 200, adminUserResponseSchema.parse(user));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminUserEntitlementMatch = /^\/v1\/admin\/users\/([^/?]+)\/entitlements$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "GET" && adminUserEntitlementMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const entitlement = await getAdminUserEntitlements(decodeURIComponent(adminUserEntitlementMatch[1]!));
        writeJson(response, 200, adminUserEntitlementResponseSchema.parse(entitlement));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && adminUserEntitlementMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = updateAdminUserEntitlementRequestSchema.safeParse(
          await readJsonBody(request)
        );
        if (!parsed.success) {
          writeApiError(
            response,
            400,
            "admin_user_entitlement_invalid",
            "Brugerens abonnement er ugyldigt."
          );
          return;
        }
        const entitlement = await updateAdminUserEntitlement(
          admin.userId,
          decodeURIComponent(adminUserEntitlementMatch[1]!),
          parsed.data
        );
        writeJson(
          response,
          200,
          adminUserEntitlementResponseSchema.parse(entitlement)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/admin/entitlements/config") {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        writeJson(response, 200, adminEntitlementConfigResponseSchema.parse(await listAdminEntitlementConfigs()));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminEntitlementConfigMatch = /^\/v1\/admin\/entitlements\/config\/(free|pro)$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "PUT" && adminEntitlementConfigMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = updateAdminEntitlementPlanConfigRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "entitlement_config_invalid", "Plan-konfigurationen er ugyldig.");
          return;
        }
        const updated = await updateAdminEntitlementPlanConfig(admin.userId, adminEntitlementConfigMatch[1] as "free" | "pro", parsed.data);
        writeJson(response, 200, { plan: updated });
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/houses" ||
      request.url?.startsWith("/v1/admin/houses?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const houses = await listAdminHouses(url.searchParams);
        writeJson(response, 200, adminHousesResponseSchema.parse(houses));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminHouseMatch = /^\/v1\/admin\/houses\/([^/?]+)$/.exec(
    (request.url ?? "").split("?")[0] ?? ""
  );
  if (request.method === "GET" && adminHouseMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const house = await getAdminHouse(decodeURIComponent(adminHouseMatch[1]!));
        writeJson(response, 200, adminHouseResponseSchema.parse(house));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminClaimMatch = /^\/v1\/admin\/house-claims\/([^/]+)\/(approve|reject)$/.exec((request.url ?? "").split("?")[0] ?? "");
  if (request.method === "POST" && adminClaimMatch) {
    void (async () => { try { const admin = await requireAdminUser(getBearerToken(request)); const payload = await readJsonBody(request) as { note?: string }; writeJson(response, 200, await resolveHouseClaim(decodeURIComponent(adminClaimMatch[1]!), admin.userId, adminClaimMatch[2] as "approve" | "reject", payload.note?.trim() || null)); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }
  if (request.method === "GET" && (request.url === "/v1/admin/house-claims" || request.url?.startsWith("/v1/admin/house-claims?"))) {
    void (async () => { try { await requireAdminUser(getBearerToken(request)); const url = new URL(request.url ?? "/", `http://${host}:${port}`); const status = adminHouseClaimStatusFilterSchema.parse(url.searchParams.get("status") ?? "pending"); const values: string[] = []; const where = status === "all" ? "" : "where c.status = $1"; if (status !== "all") values.push(status); const result = await pool.query(`select c.id, c.house_id, c.user_id, c.claim_type, c.status, c.requested_at, c.resolved_at, c.verification_method, c.resolution_note, u.email as user_email, up.display_name as user_display_name, h.address_label, h.bfe_number from house_claims c join users u on u.id = c.user_id left join user_profiles up on up.user_id = u.id join houses h on h.id = c.house_id ${where} order by c.requested_at desc limit 100`, values); writeJson(response, 200, adminHouseClaimsResponseSchema.parse({ claims: result.rows.map((row) => ({ id: row.id, userId: row.user_id, userDisplayName: row.user_display_name, userEmail: row.user_email, houseId: row.house_id, addressLabel: row.address_label, bfeNumber: row.bfe_number, claimType: row.claim_type, status: row.status, requestedAt: new Date(row.requested_at).toISOString(), resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null, verificationMethod: row.verification_method, resolutionNote: row.resolution_note })), generatedAt: new Date().toISOString() })); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }

  if (request.method === "GET" && (request.url === "/v1/admin/house-invitations" || request.url?.startsWith("/v1/admin/house-invitations?"))) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const status = adminHouseInvitationStatusFilterSchema.parse(url.searchParams.get("status") ?? "all");
        const values: string[] = [];
        const where = status === "all" ? "" : "where i.status = $1";
        if (status !== "all") values.push(status);
        const result = await pool.query(`
          select i.id, i.house_id, h.address_label, h.bfe_number, i.email, i.role, i.status,
                 i.invited_by_user_id, inviter_profile.display_name as invited_by_display_name,
                 inviter.email as invited_by_email, i.accepted_by_user_id,
                 accepter_profile.display_name as accepted_by_display_name,
                 accepter.email as accepted_by_email, i.accepted_at, i.created_at,
                 i.expires_at, i.updated_at
          from house_invitations i
          join houses h on h.id = i.house_id
          join users inviter on inviter.id = i.invited_by_user_id
          left join user_profiles inviter_profile on inviter_profile.user_id = inviter.id
          left join users accepter on accepter.id = i.accepted_by_user_id
          left join user_profiles accepter_profile on accepter_profile.user_id = accepter.id
          ${where}
          order by case i.status when 'pending' then 0 when 'accepted' then 1 when 'expired' then 2 when 'revoked' then 3 else 4 end,
                   i.created_at desc
          limit 100
        `, values);
        writeJson(response, 200, adminHouseInvitationsResponseSchema.parse({
          invitations: result.rows.map((row) => ({
            id: row.id,
            houseId: row.house_id,
            addressLabel: row.address_label,
            bfeNumber: row.bfe_number,
            email: row.email,
            role: row.role,
            status: row.status,
            invitedByUserId: row.invited_by_user_id,
            invitedByDisplayName: row.invited_by_display_name,
            invitedByEmail: row.invited_by_email,
            acceptedByUserId: row.accepted_by_user_id,
            acceptedByDisplayName: row.accepted_by_display_name,
            acceptedByEmail: row.accepted_by_email,
            acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
            createdAt: new Date(row.created_at).toISOString(),
            expiresAt: new Date(row.expires_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString()
          })),
          generatedAt: new Date().toISOString()
        }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (
    request.method === "GET" &&
    (request.url === "/v1/admin/recommendations/catalog" ||
      request.url?.startsWith("/v1/admin/recommendations/catalog?"))
  ) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const catalog = await listAdminRecommendationCatalog(url.searchParams);
        writeJson(
          response,
          200,
          adminRecommendationCatalogResponseSchema.parse(catalog)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const adminRecommendationCatalogMatch =
    /^\/v1\/admin\/recommendations\/catalog\/([^/?]+)$/.exec(
      (request.url ?? "").split("?")[0] ?? ""
    );
  if (request.method === "GET" && adminRecommendationCatalogMatch) {
    void (async () => {
      try {
        await requireAdminUser(getBearerToken(request));
        const item = await getAdminRecommendationCatalogItem(
          decodeURIComponent(adminRecommendationCatalogMatch[1]!)
        );
        writeJson(
          response,
          200,
          adminRecommendationCatalogItemResponseSchema.parse(item)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PATCH" && adminRecommendationCatalogMatch) {
    void (async () => {
      try {
        const admin = await requireAdminUser(getBearerToken(request));
        const parsed = updateAdminRecommendationGuideRequestSchema.safeParse(await readJsonBody(request));
        if (!parsed.success) {
          writeApiError(response, 400, "admin_recommendation_guide_invalid", "Vejledningskoblingen er ugyldig.");
          return;
        }
        const item = await updateAdminRecommendationGuide(decodeURIComponent(adminRecommendationCatalogMatch[1]!), parsed.data, admin.userId);
        writeJson(response, 200, adminRecommendationCatalogItemResponseSchema.parse(item));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/auth/magic-link/request") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = requestMagicLinkRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeJson(response, 200, requestMagicLinkResponseSchema.parse(authPublicResponse));
          return;
        }

        const ipHash = requestIpHash(request);
        const agentHint = userAgentHint(request);
        const created = await createMagicLinkToken(parsedRequest.data.email, {
          ...(ipHash ? { ipHash } : {}),
          ...(agentHint ? { userAgentHint: agentHint } : {})
        });
        const delivery = await sendMagicLinkEmail({
          to: created.user.email,
          magicLink: createMagicLinkUrl(created.token),
          expiresAt: created.expiresAt
        });

        writeJson(
          response,
          200,
          requestMagicLinkResponseSchema.parse({
            ...authPublicResponse,
            ...delivery
          })
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          writeJson(response, 200, requestMagicLinkResponseSchema.parse(authPublicResponse));
          return;
        }

        console.error(
          JSON.stringify({
            event: "auth.magic_link.request_failed",
            errorName: error instanceof Error ? error.name : "UnknownError",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Unknown magic-link delivery error"
          })
        );
        writeApiError(response, 503, "magic_link_email_unavailable", "Matriva kunne ikke sende loginlinket lige nu.");
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/auth/magic-link/consume") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = consumeMagicLinkRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(response, 401, "magic_link_invalid", "Loginlinket er ugyldigt eller udløbet.");
          return;
        }

        const session = await consumeMagicLinkToken(parsedRequest.data.token);
        writeJson(response, 200, authSessionResponseSchema.parse(session));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/auth/refresh") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = refreshSessionRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(response, 401, "session_invalid", "Sessionen er udløbet.");
          return;
        }

        const session = await refreshSession(parsedRequest.data.refreshToken);
        writeJson(response, 200, authSessionResponseSchema.parse(session));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/auth/logout") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request);
        const parsedRequest = logoutRequestSchema.safeParse(payload);
        await logoutSession(userId, parsedRequest.success ? parsedRequest.data.refreshToken : undefined);
        writeJson(response, 200, logoutResponseSchema.parse({ ok: true }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/me") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const [user, profile] = await Promise.all([
          getUserById(userId),
          getProfileForUser(userId)
        ]);
        writeJson(response, 200, currentUserResponseSchema.parse({ user, profile }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && request.url === "/v1/me/profile") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request);
        const parsedRequest = updateProfileRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(response, 400, "profile_request_invalid", "Profilen kræver både fornavn og efternavn.");
          return;
        }

        const profile = await updateProfile(userId, parsedRequest.data);
        writeJson(response, 200, updateProfileResponseSchema.parse({ profile }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && request.url === "/v1/me/maintenance-settings") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request);
        const parsedRequest = updateMaintenanceSettingsRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_settings_request_invalid",
            "Vedligeholdelsesindstillingerne er ugyldige."
          );
          return;
        }

        const profile = await updateMaintenanceSettings(userId, parsedRequest.data);
        writeJson(
          response,
          200,
          updateMaintenanceSettingsResponseSchema.parse({ profile })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && request.url === "/v1/me/default-house") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const parsedRequest = updateDefaultHouseRequestSchema.safeParse(await readJsonBody(request));
        if (!parsedRequest.success) {
          writeApiError(response, 400, "default_house_request_invalid", "Standardboligen er ugyldig.");
          return;
        }
        const profile = await updateDefaultHouse(userId, parsedRequest.data);
        writeJson(response, 200, updateDefaultHouseResponseSchema.parse({ profile }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/app-bootstrap") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const compatibility = evaluateMobileCompatibility(
          mobileClientIdentityFromHeaders(request.headers),
          mobileCompatibilityPolicyFromEnvironment()
        );

        if (compatibility.status === "upgrade_required") {
          writeApiError(
            response,
            426,
            "app_update_required",
            "Denne version af Matriva skal opdateres for at fortsætte.",
            { compatibility }
          );
          return;
        }

        const bootstrap = await buildAppBootstrap(userId);
        const publicDataSummaries = await getHousePublicDataSummaries(
          userId,
          bootstrap.houses
        );
        writeJson(
          response,
          200,
          appBootstrapResponseSchema.parse({
            ...bootstrap,
            compatibility,
            publicDataSummaries
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url === "/v1/bootstrap") {
    const compatibility = evaluateMobileCompatibility(
      mobileClientIdentityFromHeaders(request.headers),
      mobileCompatibilityPolicyFromEnvironment()
    );

    if (compatibility.status === "upgrade_required") {
      writeApiError(
        response,
        426,
        "app_update_required",
        "Denne version af Matriva skal opdateres for at fortsætte.",
        { compatibility }
      );
      return;
    }

    const now = new Date().toISOString();
    const body = homeBootstrapResponseSchema.parse({
      user: {
        id: "usr_k7q4m2x9p8vn",
        displayName: "Development user",
        email: null
      },
      house: {
        id: "house_p9x2v7q4m8kn",
        displayName: "Skeleton house",
        address: {
          streetName: "Eksempelvej",
          houseNumber: "1",
          postalCode: "1000",
          city: "København",
          countryCode: "DK"
        },
        propertyType: "UNKNOWN"
      },
      compatibility,
      entitlements: {
        plan: "free",
        configuredPlan: "free",
        accessPlan: "free",
        status: "free",
        source: "default",
        complimentaryProGrant: null,
        features: {
          "houses.maxActive": { kind: "limit", value: 1 },
          "documents.maxCount": { kind: "limit", value: 2 },
          "documents.maxStorageMb": { kind: "limit", value: 10 },
          "tasks.maxActive": { kind: "limit", value: 4 },
          "maintenance.fullPlan.enabled": { kind: "boolean", value: true },
          "seasonalRecommendations.enabled": { kind: "boolean", value: true },
          "advisories.enabled": { kind: "boolean", value: false },
          "localAdvisories.enabled": { kind: "boolean", value: false },
          "legalUpdates.enabled": { kind: "boolean", value: false },
          "documentExpiry.enabled": { kind: "boolean", value: true },
          "sharing.enabled": { kind: "boolean", value: false },
          "multiUser.enabled": { kind: "boolean", value: false },
          "export.enabled": { kind: "boolean", value: false },
          "history.extended.enabled": { kind: "boolean", value: false },
          "advancedReminders.enabled": { kind: "boolean", value: false }
        },
        usage: {
          houses: { active: 0, limit: 1 },
          documents: { active: 0, storageBytes: 0, limit: 2, storageLimitBytes: 10 * 1024 * 1024 },
          tasks: { active: 0, limit: 4 }
        },
        evaluatedAt: now
      },
      cards: [
        {
          id: "card_m4v8q2x7k9pn",
          type: "SYSTEM_NOTICE",
          title: "Skeleton contract",
          shortExplanation:
            "Development-only bootstrap response for validating the shared API contract.",
          severity: "info",
          action: {
            label: "No action",
            target: { kind: "none" }
          },
          validFrom: now,
          validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          audience: {
            countryCode: "DK",
            propertyTypes: ["UNKNOWN"]
          },
          minAppVersion: "0.1.0",
          fallbackText:
            "Matriva is preparing the first backend-driven home card contract."
        }
      ],
      generatedAt: now,
      skeleton: true
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "GET" && request.url === "/v1/houses") {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const houses = await listSavedHouses(userId);
        writeJson(
          response,
          200,
          savedHousesResponseSchema.parse({
            houses,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/houses") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = createSavedHouseRequestSchema.safeParse(payload);

        if (
          !parsedRequest.success ||
          parsedRequest.data.selectedAddress.source !== "DAWA"
        ) {
          writeApiError(
            response,
            400,
            "saved_house_request_invalid",
            "Saved house creation requires selected DAWA address data."
          );
          return;
        }

        const userId = await requireUserId(request);
        let identity;
        try {
          identity = await new DatafordelerClient().identifyAddress(parsedRequest.data.selectedAddress.sourceAddressId);
        } catch (error) {
          if (error instanceof DatafordelerProviderError) {
            writeApiError(response, 503, "property_identity_unavailable", "Vi kunne ikke identificere ejendommen lige nu. Prøv igen senere.");
            return;
          }
          throw error;
        }
        const existing = await findHouseByBfe(identity.bfeNumber);
        if (existing && !(await hasActiveHouseMembership(userId, existing.id))) {
          writeJson(response, 200, { status: "claim_required", house: { id: existing.id, bfeNumber: existing.bfeNumber }, message: "Ejendommen findes allerede i Matriva. For at beskytte boligens oplysninger skal din adgang bekræftes." });
          return;
        }
        const house = await createSavedHouse(userId, parsedRequest.data.selectedAddress, identity.bfeNumber);
        if (!(await hasActiveHouseMembership(userId, house.id))) {
          writeJson(response, 200, { status: "claim_required", house: { id: house.id, bfeNumber: house.bfeNumber }, message: "Ejendommen findes allerede i Matriva. For at beskytte boligens oplysninger skal din adgang bekræftes." });
          return;
        }
        startHousePublicDataRefreshAfterHouseCreated(userId, house.id);
        writeJson(
          response,
          201,
          savedHouseResponseSchema.parse({ house })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseClaimsMatch = /^\/v1\/houses\/([^/]+)\/claims$/.exec(request.url ?? "");
  if (request.method === "POST" && houseClaimsMatch) {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request) as { claimType?: unknown };
        const claimType = payload.claimType === "owner" || payload.claimType === "resident" || payload.claimType === "household_member" ? payload.claimType : "resident";
        const houseId = decodeURIComponent(houseClaimsMatch[1]!);
        const house = await findHouseByBfe((await pool.query<{ bfe_number: string }>("select bfe_number from houses where id = $1", [houseId])).rows[0]?.bfe_number ?? "");
        if (!house || house.id !== houseId) throw new ApiError(404, "house_not_found", "Saved house was not found.");
        if (await hasActiveHouseMembership(userId, houseId)) throw new ApiError(409, "house_membership_exists", "You already have access to this house.");
        const created = await createHouseClaim(userId, houseId, claimType);
        for (const notification of created.notifications) {
          await sendHouseClaimOwnerEmail({
            to: notification.owner_email,
            ownerName: notification.owner_name,
            requesterName: notification.requester_name,
            requesterEmail: notification.requester_email,
            addressLabel: notification.address_label,
            bfeNumber: notification.bfe_number,
            approvalLink: createHouseClaimApprovalUrl(created.ownerActionToken),
            expiresAt: created.ownerActionExpiresAt
          });
        }
        writeJson(response, 201, { claim: created.claim });
      } catch (error) { writeUnknownApiError(response, error); }
    })();
    return;
  }

  const houseMembersMatch = /^\/v1\/houses\/([^/]+)\/members$/.exec(request.url ?? "");
  if (request.method === "GET" && houseMembersMatch) {
    void (async () => { try { const userId = await requireUserId(request); writeJson(response, 200, await listHouseMembers(userId, decodeURIComponent(houseMembersMatch[1]!))); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }
  if (request.method === "POST" && houseMembersMatch) {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request) as { email?: string; role?: unknown };
        if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new ApiError(400, "invitation_email_invalid", "Email is required.");
        const house = await getSavedHouse(userId, decodeURIComponent(houseMembersMatch[1]!));
        const invitation = await createHouseInvitation(userId, house.id, payload.email, payload.role === "owner" ? "owner" : "member");
        if ("token" in invitation) {
          const delivery = await sendHouseInvitationEmail({ to: invitation.email, invitationLink: createHouseInvitationUrl(invitation.token), addressLabel: house.addressLabel, expiresAt: new Date(invitation.expires_at) });
          writeJson(response, 201, { invitation: { id: invitation.id, houseId: invitation.house_id, email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: new Date(invitation.expires_at).toISOString() }, delivery });
        } else if ("alreadyPending" in invitation) {
          writeJson(response, 200, { invitation: invitation.invitation });
        } else {
          writeJson(response, 200, { invitation: { houseId: invitation.houseId, alreadyMember: true } });
        }
      } catch (error) { writeUnknownApiError(response, error); }
    })();
    return;
  }
  const houseMembershipMatch = /^\/v1\/houses\/([^/]+)\/members\/([^/]+)$/.exec(request.url ?? "");
  if (request.method === "DELETE" && houseMembershipMatch) {
    void (async () => {
      try {
        const userId = await requireUserId(request);
        writeJson(response, 200, await revokeHouseMembership(userId, decodeURIComponent(houseMembershipMatch[1]!), decodeURIComponent(houseMembershipMatch[2]!)));
      } catch (error) { writeUnknownApiError(response, error); }
    })();
    return;
  }
  const houseInvitationMatch = /^\/v1\/houses\/([^/]+)\/invitations\/([^/]+)$/.exec(request.url ?? "");
  if (request.method === "DELETE" && houseInvitationMatch) {
    void (async () => { try { const userId = await requireUserId(request); writeJson(response, 200, await revokeHouseInvitation(userId, decodeURIComponent(houseInvitationMatch[1]!), decodeURIComponent(houseInvitationMatch[2]!))); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }
  if (request.method === "POST" && request.url === "/v1/house-invitations/accept") {
    void (async () => { try { const userId = await requireUserId(request); const payload = await readJsonBody(request) as { token?: string }; if (!payload.token) throw new ApiError(400, "invitation_token_required", "Invitation token is required."); writeJson(response, 200, await acceptHouseInvitation(userId, payload.token)); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }
  const houseInvitationAcceptMatch = /^\/v1\/house-invitations\/([^/]+)\/accept$/.exec(request.url ?? "");
  if (request.method === "POST" && houseInvitationAcceptMatch) {
    void (async () => { try { const userId = await requireUserId(request); writeJson(response, 200, await acceptHouseInvitationById(userId, decodeURIComponent(houseInvitationAcceptMatch[1]!))); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/house-claims/owner-approve") {
    void (async () => { try { const userId = await requireUserId(request); const payload = await readJsonBody(request) as { token?: string }; if (!payload.token) throw new ApiError(400, "house_claim_action_token_required", "Action token is required."); writeJson(response, 200, await approveHouseClaimByOwnerToken(userId, payload.token)); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }

  const ownerClaimActionMatch = /^\/v1\/house-claims\/([^/]+)\/(approve|reject)$/.exec(request.url ?? "");
  if (request.method === "POST" && ownerClaimActionMatch) {
    void (async () => { try { const userId = await requireUserId(request); writeJson(response, 200, await resolveHouseClaimByOwner(userId, decodeURIComponent(ownerClaimActionMatch[1]!), ownerClaimActionMatch[2] as "approve" | "reject")); } catch (error) { writeUnknownApiError(response, error); } })();
    return;
  }

  const housePublicDataMatch =
    /^\/v1\/houses\/([^/]+)\/public-data$/.exec(request.url ?? "");

  if (request.method === "GET" && housePublicDataMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(housePublicDataMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_public_data_route_invalid",
          "Public data routes require a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const publicData = await getHousePublicDataProfile(userId, parsedHouseId.data);
        writeJson(
          response,
          200,
          housePublicDataWithProfileResponseV1Schema.parse(publicData)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const housePublicDataRefreshMatch =
    /^\/v1\/houses\/([^/]+)\/public-data\/refresh$/.exec(request.url ?? "");

  if (request.method === "POST" && housePublicDataRefreshMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        housePublicDataRefreshMatch[1]
      );

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_public_data_refresh_route_invalid",
          "Public data refresh requires a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const publicData = await refreshHousePublicDataProfile(
          userId,
          parsedHouseId.data
        );
        writeJson(
          response,
          200,
          housePublicDataWithProfileResponseV1Schema.parse(publicData)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseMatch = /^\/v1\/houses\/([^/]+)$/.exec(request.url ?? "");

  if (request.method === "GET" && houseMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "saved_house_id_invalid",
          "Saved house lookup requires a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const house = await getSavedHouse(userId, parsedHouseId.data);
        writeJson(response, 200, savedHouseResponseSchema.parse({ house }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseMaintenanceTasksMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-tasks$/.exec(request.url ?? "");

  if (request.method === "GET" && houseMaintenanceTasksMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        houseMaintenanceTasksMatch[1]
      );

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_house_id_invalid",
          "Maintenance task routes require a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const tasks = await listMaintenanceTasksForHouse(userId, parsedHouseId.data);
        writeJson(
          response,
          200,
          maintenanceTasksResponseSchema.parse({
            tasks,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const requestPath = (request.url ?? "").split("?")[0] ?? "";

  const houseMaintenanceHistoryMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-history$/.exec(requestPath);

  if (request.method === "GET" && houseMaintenanceHistoryMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseMaintenanceHistoryMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "maintenance_history_house_id_invalid",
          "Maintenance history requires a valid house_ ID."
        );
        return;
      }

      try {
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const parsedQuery = maintenanceHistoryQuerySchema.safeParse({
          year: url.searchParams.get("year") ?? undefined,
          type: url.searchParams.get("type") ?? undefined
        });

        if (!parsedQuery.success) {
          writeApiError(
            response,
            400,
            "maintenance_history_query_invalid",
            "Historikfilteret er ugyldigt."
          );
          return;
        }

        const userId = await requireUserId(request);
        const history = await listMaintenanceHistoryForHouse(
          userId,
          parsedHouseId.data,
          parsedQuery.data
        );
        writeJson(
          response,
          200,
          maintenanceHistoryResponseSchema.parse({
            history,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceHistoryDetailMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-history\/([^/]+)$/.exec(requestPath);

  if (request.method === "GET" && maintenanceHistoryDetailMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceHistoryDetailMatch[1]);
      const parsedCompletionId = maintenanceCompletionIdSchema.safeParse(
        maintenanceHistoryDetailMatch[2]
      );

      if (!parsedHouseId.success || !parsedCompletionId.success) {
        writeApiError(
          response,
          400,
          "maintenance_history_detail_route_invalid",
          "Historikdetaljer kræver gyldige house_ og mcomp_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const historyEntry = await getMaintenanceHistoryEntryForHouse(
          userId,
          parsedHouseId.data,
          parsedCompletionId.data
        );
        writeJson(
          response,
          200,
          maintenanceHistoryDetailResponseSchema.parse({ historyEntry })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceHistoryReverseMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-history\/([^/]+)\/reverse$/.exec(requestPath);

  if (request.method === "POST" && maintenanceHistoryReverseMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceHistoryReverseMatch[1]);
      const parsedCompletionId = maintenanceCompletionIdSchema.safeParse(
        maintenanceHistoryReverseMatch[2]
      );

      if (!parsedHouseId.success || !parsedCompletionId.success) {
        writeApiError(
          response,
          400,
          "maintenance_history_reverse_route_invalid",
          "Tilbageførsel kræver gyldige house_ og mcomp_ IDs."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = reverseMaintenanceCompletionRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_history_reverse_invalid",
            "Tilbageførsel kræver et gyldigt notevalg."
          );
          return;
        }

        const userId = await requireUserId(request);
        const result = await reverseMaintenanceCompletionForHouse(
          userId,
          parsedHouseId.data,
          parsedCompletionId.data,
          parsedRequest.data.noteHandling
        );
        writeJson(
          response,
          200,
          reverseMaintenanceCompletionResponseSchema.parse(result)
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseDocumentsMatch =
    /^\/v1\/houses\/([^/]+)\/documents$/.exec(requestPath);

  if (request.method === "GET" && houseDocumentsMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseDocumentsMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_document_house_id_invalid",
          "Dokumentarkivet kræver et gyldigt house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const documents = await listHouseDocumentsForHouse(
          userId,
          parsedHouseId.data
        );
        writeJson(
          response,
          200,
          houseDocumentsResponseSchema.parse({
            documents,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && houseDocumentsMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseDocumentsMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_document_house_id_invalid",
          "Upload kræver et gyldigt house_ ID."
        );
        return;
      }

      let objectKey: string | null = null;

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = uploadHouseDocumentRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "house_document_request_invalid",
            "Upload kræver en gyldig JPEG, PNG, HEIC/HEIF eller PDF."
          );
          return;
        }

        const title = parsedRequest.data.title?.trim() ?? "";
        const documentType = parsedRequest.data.documentType ?? null;
        if (!title || !documentType) {
          writeApiError(
            response,
            400,
            "house_document_metadata_required",
            "Upload kræver titel og dokumenttype."
          );
          return;
        }

        const userId = await requireUserId(request);
        const content = Buffer.from(parsedRequest.data.contentBase64, "base64");
        validateDocumentBytes(
          content,
          parsedRequest.data.mimeType,
          parsedRequest.data.sizeBytes
        );
        objectKey = documentObjectKey(
          parsedHouseId.data,
          parsedRequest.data.mimeType
        );
        await writeStorageObject(objectKey, content, parsedRequest.data.mimeType);
        const documentInput = {
          objectKey,
          originalFilename: parsedRequest.data.fileName.trim(),
          mimeType: parsedRequest.data.mimeType,
          sizeBytes: parsedRequest.data.sizeBytes,
          checksumSha256: sha256Hex(content),
          title,
          category: houseDocumentCategoryForType(documentType),
          documentType,
          documentDate: parsedRequest.data.documentDate,
          relatedParty: parsedRequest.data.relatedParty,
          amountMinor: parsedRequest.data.amountMinor,
          expiresAt: parsedRequest.data.expiresAt,
          isImportant: parsedRequest.data.isImportant,
          note: parsedRequest.data.note
        };
        const document = await createHouseDocumentForHouse(
          userId,
          parsedHouseId.data,
          documentInput
        );
        writeJson(
          response,
          201,
          houseDocumentResponseSchema.parse({ document })
        );
      } catch (error) {
        if (objectKey) {
          await deleteStorageObject(objectKey);
        }

        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseDocumentMatch =
    /^\/v1\/houses\/([^/]+)\/documents\/([^/]+)$/.exec(requestPath);

  if (request.method === "PATCH" && houseDocumentMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseDocumentMatch[1]);
      const parsedDocumentId = documentIdSchema.safeParse(houseDocumentMatch[2]);
      if (!parsedHouseId.success || !parsedDocumentId.success) {
        writeApiError(response, 400, "house_document_route_invalid", "Dokumentruten er ugyldig.");
        return;
      }
      try {
        const parsedRequest = updateHouseDocumentRequestSchema.safeParse(await readJsonBody(request));
        if (!parsedRequest.success) {
          writeApiError(response, 400, "house_document_metadata_invalid", "Dokumentmetadata er ugyldig.");
          return;
        }
        const userId = await requireUserId(request);
        const document = await updateHouseDocumentForHouse(
          userId,
          parsedHouseId.data,
          parsedDocumentId.data,
          {
            ...parsedRequest.data,
            ...(parsedRequest.data.documentType !== undefined
              ? { category: houseDocumentCategoryForType(parsedRequest.data.documentType) }
              : { category: undefined })
          }
        );
        writeJson(response, 200, houseDocumentResponseSchema.parse({ document }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "DELETE" && houseDocumentMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseDocumentMatch[1]);
      const parsedDocumentId = documentIdSchema.safeParse(
        houseDocumentMatch[2]
      );

      if (!parsedHouseId.success || !parsedDocumentId.success) {
        writeApiError(
          response,
          400,
          "house_document_route_invalid",
          "Dokumentsletning kræver gyldige house_ og doc_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const { document, objectKey } = await archiveHouseDocumentForHouse(
          userId,
          parsedHouseId.data,
          parsedDocumentId.data
        );
        const references = await countActiveDocumentObjectReferences(objectKey);

        if (references === 0) {
          await deleteStorageObject(objectKey);
        }

        writeJson(
          response,
          200,
          houseDocumentResponseSchema.parse({ document })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseDocumentContentMatch =
    /^\/v1\/houses\/([^/]+)\/documents\/([^/]+)\/content$/.exec(
      requestPath
    );

  if (request.method === "GET" && houseDocumentContentMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseDocumentContentMatch[1]);
      const parsedDocumentId = documentIdSchema.safeParse(
        houseDocumentContentMatch[2]
      );

      if (!parsedHouseId.success || !parsedDocumentId.success) {
        writeApiError(
          response,
          400,
          "house_document_content_route_invalid",
          "Download kræver gyldige house_ og doc_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const { document, objectKey } = await getHouseDocumentForHouse(
          userId,
          parsedHouseId.data,
          parsedDocumentId.data
        );
        const content = await readStorageObject(objectKey, document.mimeType);
        writeBinary(response, 200, content, document.mimeType);
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseMaintenanceCatalogMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-catalog(?:\?.*)?$/.exec(
      request.url ?? ""
    );

  if (request.method === "GET" && houseMaintenanceCatalogMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseMaintenanceCatalogMatch[1]);
      if (!parsedHouseId.success) {
        writeApiError(response, 400, "maintenance_catalog_house_id_invalid", "Kataloget kræver et gyldigt house_ ID.");
        return;
      }
      try {
        const userId = await requireUserId(request);
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const scope = url.searchParams.get("scope") ?? "all";
        if (scope !== "all" && scope !== "recommended") {
          writeApiError(response, 400, "maintenance_catalog_scope_invalid", "Katalog scope skal være all eller recommended.");
          return;
        }
        const catalog = await listMaintenanceCatalogForHouse(userId, parsedHouseId.data, scope);
        writeJson(response, 200, maintenanceCatalogResponseSchema.parse(catalog));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseFactsMatch =
    /^\/v1\/houses\/([^/]+)\/house-facts(?:\/(facts|components)\/([^/]+))?$/.exec(
      (request.url ?? "").split("?")[0] ?? ""
    );

  if (request.method === "GET" && houseFactsMatch && !houseFactsMatch[2]) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseFactsMatch[1]);
      if (!parsedHouseId.success) {
        writeApiError(response, 400, "house_facts_house_id_invalid", "House facts kræver et gyldigt house_ ID.");
        return;
      }
      try {
        const userId = await requireUserId(request);
        writeJson(response, 200, houseFactsResponseSchema.parse(await getHouseFactsForHouse(userId, parsedHouseId.data)));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && houseFactsMatch && houseFactsMatch[2] && houseFactsMatch[3]) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseFactsMatch[1]);
      if (!parsedHouseId.success) {
        writeApiError(response, 400, "house_facts_house_id_invalid", "House facts kræver et gyldigt house_ ID.");
        return;
      }
      try {
        const userId = await requireUserId(request);
        const payload = await readJsonBody(request);
        if (houseFactsMatch[2] === "facts") {
          const parsed = upsertHouseFactRequestSchema.safeParse(payload);
          if (!parsed.success) {
            writeApiError(response, 400, "house_fact_invalid", "Husfakta er ugyldige.");
            return;
          }
          const facts = await upsertHouseFactForHouse(userId, parsedHouseId.data, decodeURIComponent(houseFactsMatch[3]!), parsed.data);
          writeJson(response, 200, houseFactsResponseSchema.parse(facts));
          return;
        }
        const parsed = upsertHouseComponentRequestSchema.safeParse(payload);
        if (!parsed.success) {
          writeApiError(response, 400, "house_component_invalid", "Komponentdata er ugyldige.");
          return;
        }
        const facts = await upsertHouseComponentForHouse(userId, parsedHouseId.data, decodeURIComponent(houseFactsMatch[3]!), parsed.data);
        writeJson(response, 200, houseFactsResponseSchema.parse(facts));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseMaintenanceRecommendationsMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-recommendations(?:\?.*)?$/.exec(
      request.url ?? ""
    );

  if (request.method === "GET" && houseMaintenanceRecommendationsMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        houseMaintenanceRecommendationsMatch[1]
      );

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "maintenance_recommendation_house_id_invalid",
          "Maintenance recommendations require a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const url = new URL(request.url ?? "/", `http://${host}:${port}`);
        const requestedStatus = url.searchParams.get("status") ?? "pending";
        const parsedStatus = maintenanceRecommendationStatusSchema.safeParse(requestedStatus);

        if (!parsedStatus.success || (parsedStatus.data !== "pending" && parsedStatus.data !== "dismissed")) {
          writeApiError(
            response,
            400,
            "maintenance_recommendation_status_invalid",
            "Recommendation status must be pending or dismissed."
          );
          return;
        }

        const recommendations = await listMaintenanceRecommendationsForHouse(
          userId,
          parsedHouseId.data,
          parsedStatus.data
        );
        writeJson(
          response,
          200,
          maintenanceRecommendationsResponseSchema.parse({
            recommendations,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && houseMaintenanceTasksMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        houseMaintenanceTasksMatch[1]
      );

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_house_id_invalid",
          "Maintenance task creation requires a valid house_ ID."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest =
          createMaintenanceTaskRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_task_request_invalid",
            "Maintenance task creation requires valid title, source, status, and timing data."
          );
          return;
        }

        const userId = await requireUserId(request);
        const task = await createMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedRequest.data
        );
        writeJson(
          response,
          201,
          maintenanceTaskResponseSchema.parse({ task })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceTaskMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-tasks\/([^/]+)$/.exec(
      request.url ?? ""
    );

  if (request.method === "GET" && maintenanceTaskMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceTaskMatch[1]);
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_route_invalid",
          "Maintenance task routes require valid house_ and task_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const task = await getMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedTaskId.data
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PATCH" && maintenanceTaskMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceTaskMatch[1]);
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_route_invalid",
          "Maintenance task updates require valid house_ and task_ IDs."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = updateMaintenanceTaskRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_task_update_invalid",
            "Opgaven kræver gyldige felter."
          );
          return;
        }

        const userId = await requireUserId(request);
        const task = await updateMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedTaskId.data,
          parsedRequest.data
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "DELETE" && maintenanceTaskMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceTaskMatch[1]);
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_route_invalid",
          "Maintenance task deletion requires valid house_ and task_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const task = await archiveMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedTaskId.data
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceTaskMoveMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-tasks\/([^/]+)\/move$/.exec(
      request.url ?? ""
    );

  if (request.method === "POST" && maintenanceTaskMoveMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceTaskMoveMatch[1]);
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskMoveMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_move_route_invalid",
          "Flyt opgave kræver gyldige house_ og task_ IDs."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = moveMaintenanceTaskRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_task_move_invalid",
            "Flyt opgave kræver gyldig ny timing."
          );
          return;
        }

        const userId = await requireUserId(request);
        const task = await moveMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedTaskId.data,
          parsedRequest.data
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceTaskCompleteMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-tasks\/([^/]+)\/complete$/.exec(
      request.url ?? ""
    );

  if (request.method === "POST" && maintenanceTaskCompleteMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(maintenanceTaskCompleteMatch[1]);
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskCompleteMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_complete_route_invalid",
          "Markér udført kræver gyldige house_ og task_ IDs."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = completeMaintenanceTaskRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_task_complete_invalid",
            "Afslutning kræver gyldig udført dato og metadata."
          );
          return;
        }

        const userId = await requireUserId(request);
        const result = await completeMaintenanceTaskForHouse(
          userId,
          parsedHouseId.data,
          parsedTaskId.data,
          parsedRequest.data
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task: result.task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceRecommendationActionMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-recommendations\/([^/]+)\/(accept|dismiss|restore)$/.exec(
      request.url ?? ""
    );

  if (request.method === "POST" && maintenanceRecommendationActionMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        maintenanceRecommendationActionMatch[1]
      );
      const parsedRecommendationId = maintenanceRecommendationIdSchema.safeParse(
        maintenanceRecommendationActionMatch[2]
      );
      const action = maintenanceRecommendationActionMatch[3];

      if (!parsedHouseId.success || !parsedRecommendationId.success) {
        writeApiError(
          response,
          400,
          "maintenance_recommendation_route_invalid",
          "Recommendation routes require valid house_ and mrec_ IDs."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);

        if (action === "restore") {
          const recommendation = await restoreMaintenanceRecommendationForHouse(
            userId,
            parsedHouseId.data,
            parsedRecommendationId.data
          );
          writeJson(
            response,
            200,
            dismissMaintenanceRecommendationResponseSchema.parse({ recommendation })
          );
          return;
        }

        if (action === "accept") {
          const payload = await readJsonBody(request);
          const parsedRequest =
            acceptMaintenanceRecommendationRequestSchema.safeParse(payload);

          if (!parsedRequest.success) {
            writeApiError(
              response,
              400,
              "maintenance_recommendation_accept_invalid",
              "Tilføj til vedligeholdelse kræver gyldig timing."
            );
            return;
          }

          const task = await acceptMaintenanceRecommendationForHouse(
            userId,
            parsedHouseId.data,
            parsedRecommendationId.data,
            parsedRequest.data
          );
          writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
          return;
        }

        const payload = await readJsonBody(request);
        const parsedRequest =
          dismissMaintenanceRecommendationRequestSchema.safeParse(payload ?? {});

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_recommendation_dismiss_invalid",
            "Afvisning kræver en gyldig handling."
          );
          return;
        }

        const recommendation = await dismissMaintenanceRecommendationForHouse(
          userId,
          parsedHouseId.data,
          parsedRecommendationId.data,
          parsedRequest.data.mode
        );
        writeJson(
          response,
          200,
          dismissMaintenanceRecommendationResponseSchema.parse({ recommendation })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const maintenanceTaskStatusMatch =
    /^\/v1\/houses\/([^/]+)\/maintenance-tasks\/([^/]+)\/status$/.exec(
      request.url ?? ""
    );

  if (request.method === "PATCH" && maintenanceTaskStatusMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(
        maintenanceTaskStatusMatch[1]
      );
      const parsedTaskId = taskIdSchema.safeParse(maintenanceTaskStatusMatch[2]);

      if (!parsedHouseId.success || !parsedTaskId.success) {
        writeApiError(
          response,
          400,
          "maintenance_task_status_route_invalid",
          "Maintenance task status updates require valid house_ and task_ IDs."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest =
          updateMaintenanceTaskStatusRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "maintenance_task_status_request_invalid",
            "Maintenance task status update requires a valid status."
          );
          return;
        }

        const userId = await requireUserId(request);
        const task = await updateMaintenanceTaskStatus(
          userId,
          parsedHouseId.data,
          parsedTaskId.data,
          parsedRequest.data.status
        );
        writeJson(response, 200, maintenanceTaskResponseSchema.parse({ task }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const houseImprovementsMatch =
    /^\/v1\/houses\/([^/]+)\/improvements$/.exec(request.url ?? "");

  if (request.method === "GET" && houseImprovementsMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseImprovementsMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_improvements_house_id_invalid",
          "Improvement routes require a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const improvements = await listHouseImprovements(userId, parsedHouseId.data);
        writeJson(
          response,
          200,
          houseImprovementsResponseSchema.parse({
            improvements,
            generatedAt: new Date().toISOString()
          })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "POST" && houseImprovementsMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(houseImprovementsMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_improvement_house_id_invalid",
          "Improvement creation requires a valid house_ ID."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest =
          createHouseImprovementRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "house_improvement_request_invalid",
            "Forbedringen kræver titel og år eller dato."
          );
          return;
        }

        const userId = await requireUserId(request);
        const improvement = await createHouseImprovement(
          userId,
          parsedHouseId.data,
          parsedRequest.data
        );
        writeJson(
          response,
          201,
          houseImprovementResponseSchema.parse({ improvement })
        );
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const improvementDetailMatch = /^\/v1\/houses\/([^/]+)\/improvements\/([^/]+)$/.exec(request.url ?? "");
  const documentRelationMatch = /^\/v1\/houses\/([^/]+)\/improvements\/([^/]+)\/documents(?:\/([^/]+))?$/.exec(request.url ?? "");

  if (improvementDetailMatch || documentRelationMatch) {
    void (async () => {
      try {
        const match = improvementDetailMatch ?? documentRelationMatch;
        const parsedHouseId = houseIdSchema.safeParse(match?.[1]);
        const parsedImprovementId = improvementIdSchema.safeParse(match?.[2]);
        if (!parsedHouseId.success || !parsedImprovementId.success) { writeApiError(response, 400, "improvement_route_invalid", "Improvement route IDs are invalid."); return; }
        const userId = await requireUserId(request);
        const payload = request.method === "GET" || request.method === "DELETE" ? undefined : await readJsonBody(request);
        if (improvementDetailMatch) {
          if (request.method === "GET") { writeJson(response, 200, { improvement: await getHouseImprovement(userId, parsedHouseId.data, parsedImprovementId.data) }); return; }
          if (request.method === "PATCH") { const parsed = updateHouseImprovementRequestSchema.safeParse(payload); if (!parsed.success) { writeApiError(response,400,"improvement_request_invalid","Projektdata er ugyldige."); return; } writeJson(response,200,{ improvement: await updateHouseImprovement(userId,parsedHouseId.data,parsedImprovementId.data,parsed.data) }); return; }
          if (request.method === "DELETE") { await archiveHouseImprovement(userId,parsedHouseId.data,parsedImprovementId.data); writeJson(response,200,{ ok:true }); return; }
        }
        if (documentRelationMatch) { const documentId=documentRelationMatch[3]; if(request.method==="POST"&&!documentId){const p=attachHouseImprovementDocumentRequestSchema.safeParse(payload);if(!p.success){writeApiError(response,400,"improvement_document_invalid","Dokumentrelationen er ugyldig.");return;}writeJson(response,201,{improvement:await createHouseImprovementDocumentRelation(userId,parsedHouseId.data,parsedImprovementId.data,p.data)});return;}if(documentId&&request.method==="DELETE"){await deleteHouseImprovementDocumentRelation(userId,parsedHouseId.data,parsedImprovementId.data,documentId);writeJson(response,200,{ok:true});return;} }
        writeApiError(response,405,"method_not_allowed","Methoden understøttes ikke.");
      } catch (error) { writeUnknownApiError(response,error); }
    })();
    return;
  }

  const housePhotoMatch = /^\/v1\/houses\/([^/]+)\/photo$/.exec(request.url ?? "");

  if (request.method === "GET" && housePhotoMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(housePhotoMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_photo_house_id_invalid",
          "House photo routes require a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const photo = await getCurrentHousePhoto(userId, parsedHouseId.data);
        writeJson(response, 200, housePhotoResponseSchema.parse({ photo }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "PUT" && housePhotoMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(housePhotoMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_photo_house_id_invalid",
          "House photo upload requires a valid house_ ID."
        );
        return;
      }

      try {
        const payload = await readJsonBody(request);
        const parsedRequest = uploadHousePhotoRequestSchema.safeParse(payload);

        if (!parsedRequest.success) {
          writeApiError(
            response,
            400,
            "house_photo_request_invalid",
            "Husfoto kræver en gyldig billedfil."
          );
          return;
        }

        const userId = await requireUserId(request);
        const content = Buffer.from(parsedRequest.data.contentBase64, "base64");

        if (content.byteLength !== parsedRequest.data.sizeBytes) {
          writeApiError(
            response,
            400,
            "house_photo_size_mismatch",
            "Husfotoets størrelse matcher ikke uploaden."
          );
          return;
        }

        const storageKey = mediaStorageKey(parsedHouseId.data, parsedRequest.data.mimeType);
        await writeStorageObject(storageKey, content, parsedRequest.data.mimeType);
        const photo = await replaceHousePhoto(userId, parsedHouseId.data, {
          mimeType: parsedRequest.data.mimeType,
          sizeBytes: parsedRequest.data.sizeBytes,
          ...(parsedRequest.data.width ? { width: parsedRequest.data.width } : {}),
          ...(parsedRequest.data.height ? { height: parsedRequest.data.height } : {}),
          storageKey
        });
        writeJson(response, 200, housePhotoResponseSchema.parse({ photo }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "DELETE" && housePhotoMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(housePhotoMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_photo_house_id_invalid",
          "House photo removal requires a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        await removeHousePhoto(userId, parsedHouseId.data);
        writeJson(response, 200, housePhotoResponseSchema.parse({ photo: null }));
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  const housePhotoContentMatch =
    /^\/v1\/houses\/([^/]+)\/photo\/content$/.exec((request.url ?? "").split("?")[0] ?? "");

  if (request.method === "GET" && housePhotoContentMatch) {
    void (async () => {
      const parsedHouseId = houseIdSchema.safeParse(housePhotoContentMatch[1]);

      if (!parsedHouseId.success) {
        writeApiError(
          response,
          400,
          "house_photo_content_house_id_invalid",
          "House photo content requires a valid house_ ID."
        );
        return;
      }

      try {
        const userId = await requireUserId(request);
        const photo = await getCurrentHousePhoto(userId, parsedHouseId.data);

        if (!photo) {
          writeApiError(response, 404, "house_photo_not_found", "Husfoto blev ikke fundet.");
          return;
        }

        const content = await readStorageObject(photo.storageKey, photo.mimeType);
        writeBinary(response, 200, content, photo.mimeType);
      } catch (error) {
        writeUnknownApiError(response, error);
      }
    })();
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/v1/addresses/search")) {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const parsedQuery = addressSearchQuerySchema.safeParse({
        q: url.searchParams.get("q") ?? ""
      });

      if (!parsedQuery.success) {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "address_search_query_invalid",
            message: "Address search query must be at least 2 characters."
          })
        );
        return;
      }

      try {
        const dawaAddresses = await fetchDawaAddresses(parsedQuery.data.q);
        const suggestions = dawaAddresses.flatMap((address) => {
          const sourceAddressId = optionalString(address.id);

          if (!sourceAddressId) {
            return [];
          }

          return [
            {
              id: createAddressSuggestionId(),
              source: "DAWA",
              sourceAddressId,
              sourceAccessAddressId: optionalString(
                address.adgangsadresse?.id
              ),
              label:
                optionalString(address.adressebetegnelse) ?? sourceAddressId,
              roadName:
                optionalString(address.adgangsadresse?.vejstykke?.navn) ??
                optionalString(
                  address.adgangsadresse?.vejstykke?.adresseringsnavn
                ),
              houseNumber: optionalString(address.adgangsadresse?.husnr),
              floor: optionalString(address.etage),
              door: optionalString(address.dør),
              postalCode: optionalString(address.adgangsadresse?.postnummer?.nr),
              city: optionalString(address.adgangsadresse?.postnummer?.navn)
            }
          ];
        });

        const body = addressSearchResponseSchema.parse({
          query: parsedQuery.data.q,
          source: "DAWA",
          suggestions,
          generatedAt: new Date().toISOString()
        });

        writeJson(response, 200, body);
      } catch {
        writeJson(
          response,
          502,
          apiErrorSchema.parse({
            code: "address_search_source_unavailable",
            message: "Address search is temporarily unavailable."
          })
        );
      }
    })();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/house-drafts") {
    void (async () => {
      try {
        await requireUserId(request);
        const selectedAddress = await readJsonBody(request);
        const parsedAddress =
          selectedAddressInputSchema.safeParse(selectedAddress);

        if (!parsedAddress.success || parsedAddress.data.source !== "DAWA") {
          writeJson(
            response,
            400,
            apiErrorSchema.parse({
              code: "house_draft_selected_address_invalid",
              message:
                "House draft requires a selected DAWA address with sourceAddressId and label."
            })
          );
          return;
        }

        const now = new Date().toISOString();
        const validityEnd = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 14
        ).toISOString();
        const { postalCode, city } = extractPostalCodeAndCity(
          parsedAddress.data.label
        );

        const body = houseDraftResponseSchema.parse({
          houseDraft: {
            id: createHouseDraftId(),
            status: "draft",
            selectedAddress: parsedAddress.data,
            profile: {
              displayName: parsedAddress.data.label,
              addressLabel: parsedAddress.data.label,
              postalCode,
              city,
              propertyType: "UNKNOWN"
            },
            sourceReferences: [
              {
                source: parsedAddress.data.source,
                sourceAddressId: parsedAddress.data.sourceAddressId,
                sourceAccessAddressId:
                  parsedAddress.data.sourceAccessAddressId
              }
            ],
            createdAt: now,
            skeleton: true
          },
          cards: [
            {
              id: createHomeCardId(),
              type: "MISSING_DOCUMENT",
              title: "Skeleton: find husets vigtigste dokumenter",
              shortExplanation:
                "Development-only card for validating the house draft contract.",
              severity: "notice",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later help collect relevant house documentation."
            },
            {
              id: createHomeCardId(),
              type: "SEASONAL_RECOMMENDATION",
              title: "Skeleton: første sæsonråd",
              shortExplanation:
                "Development-only recommendation placeholder. Not production advice.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later provide backend-driven seasonal guidance."
            },
            {
              id: createHomeCardId(),
              type: "TASK_REMINDER",
              title: "Skeleton: første vedligeholdelsesopgave",
              shortExplanation:
                "Development-only task reminder placeholder. No task has been created.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later generate maintenance tasks from backend rules."
            }
          ],
          generatedAt: now,
          skeleton: true
        });

        writeJson(response, 201, body);
      } catch {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "house_draft_request_invalid",
            message: "House draft request body must be valid JSON."
          })
        );
      }
    })();
    return;
  }

  const overviewPreviewMatch = /^\/v1\/house-drafts\/([^/]+)\/overview-preview$/.exec(
    request.url ?? ""
  );

  if (request.method === "GET" && overviewPreviewMatch) {
    const parsedHouseDraftId = houseDraftIdSchema.safeParse(
      overviewPreviewMatch[1]
    );

    if (!parsedHouseDraftId.success) {
      writeJson(
        response,
        400,
        apiErrorSchema.parse({
          code: "house_draft_overview_preview_id_invalid",
          message: "Overview preview requires a valid house_draft_ ID."
        })
      );
      return;
    }

    const now = new Date().toISOString();
    const body = houseDraftOverviewPreviewResponseSchema.parse({
      version: "house_draft_overview_preview.v1",
      houseDraftId: parsedHouseDraftId.data,
      draftStatus: "draft",
      dataConfidence: "not_verified",
      title: "Mit hus",
      subtitle: "Overblik",
      warningTitle: "Ikke verificerede boligdata",
      warningBody:
        "Dette er et første preview baseret på dit house draft. Matriva har endnu ikke verificeret boligdata mod live BBR/Datafordeler.",
      sections: [
        {
          kind: "overview",
          title: "Overblik",
          intro:
            "Et roligt startpunkt for huset, indtil verificerede boligdata er klar.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Første husprofil",
              body:
                "Matriva har oprettet et midlertidigt draft, så du kan se produktets struktur uden verificerede boligdata.",
              statusLabel: "Ikke verificeret"
            }
          ]
        },
        {
          kind: "documents",
          title: "Dokumenter",
          intro:
            "Dokumentområdet er synligt som preview, men upload og arkiv er ikke aktiveret endnu.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Dokumentarkiv kommer senere",
              body:
                "Her vil Matriva samle relevante dokumenter, når dokumentfunktionen bliver tilføjet.",
              statusLabel: "Kommer senere",
              cta: {
                label: "Upload dokument",
                enabled: false,
                reason: "Dokumentupload er ikke implementeret i dette preview."
              }
            }
          ]
        },
        {
          kind: "maintenance",
          title: "Vedligehold",
          intro:
            "Vedligehold hjælper dig med at holde styr på egne opgaver og relevante anbefalinger for boligen.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Skift filter i ventilation",
              body:
                "Eksempel på en opgave du selv kan oprette med deadline.",
              statusLabel: "Forfalder om 12 dage",
              maintenance: {
                source: "user_created",
                status: "coming_up",
                timingType: "specific_deadline",
                dueDate: createDateOnlyDaysFromNow(12),
                daysUntilDue: 12
              },
              cta: {
                label: "Ikke aktiv endnu",
                enabled: false,
                reason:
                  "Opgavehandlinger kobles på, når vedligeholdelsesmodulet bygges."
              }
            },
            {
              id: createOverviewPreviewCardId(),
              title: "Rens tagrender",
              body:
                "Anbefalet vedligeholdelsespunkt med konkret deadline.",
              statusLabel: "Overskredet med 8 dage",
              maintenance: {
                source: "matriva_recommended",
                status: "overdue",
                timingType: "specific_deadline",
                dueDate: createDateOnlyDaysFromNow(-8),
                daysOverdue: 8
              },
              cta: {
                label: "Ikke aktiv endnu",
                enabled: false,
                reason:
                  "Opgavehandlinger kobles på, når vedligeholdelsesmodulet bygges."
              }
            },
            {
              id: createOverviewPreviewCardId(),
              title: "Tjek udendørs træværk",
              body:
                "Anbefalet vedligeholdelsespunkt for sæsonen.",
              statusLabel: "Relevant i efteråret",
              maintenance: {
                source: "matriva_recommended",
                status: "suggested",
                timingType: "seasonal_window",
                season: "autumn"
              },
              cta: {
                label: "Ikke aktiv endnu",
                enabled: false,
                reason:
                  "Opgavehandlinger kobles på, når vedligeholdelsesmodulet bygges."
              }
            }
          ]
        },
        {
          kind: "next_actions",
          title: "Mangler / næste handling",
          intro:
            "Næste handlinger hjælper med at vise, hvad der mangler før et rigtigt husoverblik.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Afvent verificering af boligdata",
              body:
                "Det næste rigtige skridt er en backend-ejet verificering, før Matriva må præsentere boligdata som korrekte.",
              statusLabel: "Ikke verificeret"
            }
          ]
        }
      ],
      generatedAt: now,
      skeleton: true
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/house-drafts/enrich") {
    void (async () => {
      try {
        await requireUserId(request);
        const payload = await readJsonBody(request);
        const parsedRequest = enrichHouseDraftRequestSchema.safeParse(payload);

        if (
          !parsedRequest.success ||
          parsedRequest.data.selectedAddress.source !== "DAWA" ||
          !houseDraftIdSchema.safeParse(parsedRequest.data.houseDraftId).success
        ) {
          writeJson(
            response,
            400,
            apiErrorSchema.parse({
              code: "house_draft_enrichment_request_invalid",
              message:
                "House draft enrichment requires a house_draft_ ID and selected DAWA address references."
            })
          );
          return;
        }

        const now = new Date().toISOString();
        const validityEnd = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 14
        ).toISOString();
        const datafordelerStatus = getDatafordelerConfigStatus();
        const datafordelerWarning =
          datafordelerStatus.authMode === "unsupported"
            ? {
                code: "unsupported_auth_mode",
                message:
                  "BBR/Datafordeler enrichment is unavailable for this API configuration."
              }
            : (datafordelerStatus.authMode === "api_key" ||
                  datafordelerStatus.authMode === "oauth") &&
                datafordelerStatus.graphqlUrlConfigured &&
                datafordelerStatus.apiKeyConfigured
              ? {
                  code: "credentials_configured_not_implemented",
                  message:
                    "BBR/Datafordeler credentials are configured, but live enrichment is not implemented yet."
                }
              : {
                  code: "credentials_missing",
                  message:
                    "BBR/Datafordeler enrichment is unavailable until API credentials are configured."
                };

        // TODO: Replace this skeleton branch with a server-side Datafordeler adapter.
        const body = enrichHouseDraftResponseSchema.parse({
          houseDraftId: parsedRequest.data.houseDraftId,
          enrichment: {
            status: "skeleton",
            source: {
              source: "BBR_DATAFORDELER",
              label: "BBR/Datafordeler",
              sourceAccessAddressId:
                parsedRequest.data.selectedAddress.sourceAccessAddressId,
              sourceAddressId: parsedRequest.data.selectedAddress.sourceAddressId,
              verificationStatus: "not_verified",
              integrationStatus: datafordelerWarning.code,
              skeleton: true
            },
            property: {
              propertyType: "UNKNOWN"
            },
            buildings: [],
            units: [],
            warnings: [
              datafordelerWarning.message,
              "Skeleton response must not be treated as verified BBR data."
            ],
            warningDetails: [
              datafordelerWarning,
              {
                code: "skeleton_not_verified",
                message:
                  "Skeleton response must not be treated as verified BBR data."
              }
            ],
            generatedAt: now,
            skeleton: true
          },
          profilePreview: {
            displayName: parsedRequest.data.selectedAddress.label,
            addressLabel: parsedRequest.data.selectedAddress.label,
            propertyType: "UNKNOWN"
          },
          cards: [
            {
              id: createHomeCardId(),
              type: "SYSTEM_NOTICE",
              title: "Skeleton: boligdata kan forbedre planen senere",
              shortExplanation:
                "Development-only card for validating the BBR/Datafordeler enrichment contract.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later use backend-owned BBR enrichment to make maintenance cards more relevant."
            }
          ],
          generatedAt: now,
          skeleton: true
        });

        writeJson(response, 200, body);
      } catch {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "house_draft_enrichment_body_invalid",
            message: "House draft enrichment body must be valid JSON."
          })
        );
      }
    })();
    return;
  }

  writeJson(response, 404, { error: "not_found" });
});

try {
  validateAuthRuntimeConfig();
  validateStorageConfiguration();
  await migrateDatabase();

  server.listen(port, host, () => {
    const urls = devUrlsForHost(host, port);

    console.log(`Matriva API listening on ${urls.bind}`);
    console.log(`Local health: ${urls.local}/health`);
    console.log(`iOS simulator: ${urls.iosSimulator}`);
    console.log(`Android emulator: ${urls.androidEmulator}`);
    console.log(`Physical device: ${urls.physicalDevice} when HOST=0.0.0.0`);
  });
} catch (error) {
  console.error("Matriva API failed to start.");
  console.error(error);
  process.exitCode = 1;
}
