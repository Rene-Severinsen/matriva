import { createSign } from "node:crypto";
import { adminAppleNotificationHistoryRequestSchema, adminAppleNotificationHistoryResponseSchema } from "@matriva/shared";
import { ApiError, pool } from "./db.ts";

const APPLE_HISTORY_URL = {
  sandbox: "https://api.storekit-sandbox.apple.com/inApps/v1/notifications/history",
  production: "https://api.storekit.itunes.apple.com/inApps/v1/notifications/history"
} as const;

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function applePrivateKey() {
  const configured = process.env.MATRIVA_APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!configured) return null;
  if (configured.includes("BEGIN PRIVATE KEY") || configured.includes("BEGIN EC PRIVATE KEY")) return configured;

  // Some hosting secret editors remove PEM headers and fold the body into
  // whitespace-separated text. Rebuild a standard PKCS#8 PEM without ever
  // logging or returning the key material.
  const body = configured.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/=]+$/.test(body)) return configured;
  const lines = body.match(/.{1,64}/g)?.join("\n");
  const pemHeader = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  const pemFooter = ["-----END", "PRIVATE KEY-----"].join(" ");
  return lines ? `${pemHeader}\n${lines}\n${pemFooter}` : configured;
}

function createAppleApiToken() {
  const issuerId = process.env.MATRIVA_APPLE_ISSUER_ID?.trim();
  const keyId = process.env.MATRIVA_APPLE_KEY_ID?.trim();
  const privateKey = applePrivateKey();
  if (!issuerId || !keyId || !privateKey) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: issuerId,
    iat: issuedAt,
    exp: issuedAt + 300,
    aud: "appstoreconnect-v1",
    bid: process.env.MATRIVA_APPLE_BUNDLE_ID ?? "dk.matriva.app"
  }));
  const signingInput = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64Url(signature)}`;
}

function decodedJwsPayload(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  const [, payload] = value.split(".");
  if (!payload) return {};
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded && typeof decoded === "object" ? decoded as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isoDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function configureError() {
  return new ApiError(503, "apple_notification_history_not_configured", "Apple Notification History er ikke konfigureret på denne backend.");
}

function compactRecord(item: Record<string, unknown>, includeRaw: boolean) {
  const notification = decodedJwsPayload(item.signedPayload);
  const data = notification.data && typeof notification.data === "object" ? notification.data as Record<string, unknown> : {};
  const transaction = decodedJwsPayload(data.signedTransactionInfo);
  const renewal = decodedJwsPayload(data.signedRenewalInfo);
  const firstSendAttemptResult = stringValue(item.firstSendAttemptResult);
  return {
    notificationUUID: stringValue(notification.notificationUUID),
    notificationType: stringValue(notification.notificationType),
    subtype: stringValue(notification.subtype),
    signedDate: isoDate(notification.signedDate),
    environment: stringValue(transaction.environment) ?? stringValue(notification.data && typeof notification.data === "object" ? (notification.data as Record<string, unknown>).environment : null),
    bundleId: stringValue(transaction.bundleId),
    transactionId: stringValue(transaction.transactionId),
    originalTransactionId: stringValue(transaction.originalTransactionId),
    productId: stringValue(transaction.productId) ?? stringValue(renewal.productId),
    expiresDate: isoDate(transaction.expiresDate),
    firstSendAttemptResult,
    deliveryStatus: firstSendAttemptResult === "SUCCESS" ? "delivered" : firstSendAttemptResult ? "failed" : "unknown",
    signedPayload: includeRaw && typeof item.signedPayload === "string" ? item.signedPayload : null
  } as const;
}

async function requestHistory(environment: "sandbox" | "production", token: string, body: Record<string, unknown>) {
  const response = await fetch(APPLE_HISTORY_URL[environment], {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Apple error body is not JSON. */ }
  if (!response.ok) {
    const reason = typeof payload.errorCode === "number" ? ` Apple error ${payload.errorCode}.` : "";
    throw new ApiError(502, "apple_notification_history_failed", `Apple Notification History kunne ikke hentes.${reason}`);
  }
  return payload;
}

export async function getAdminAppleNotificationHistory(userId: string, input: unknown) {
  const request = adminAppleNotificationHistoryRequestSchema.parse(input);
  const token = createAppleApiToken();
  const checkedAt = new Date().toISOString();
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - request.days * 24 * 60 * 60 * 1000);
  if (!token) {
    return adminAppleNotificationHistoryResponseSchema.parse({
      configured: false, environment: request.environment, transactionId: request.transactionId ?? null,
      startDate: startDate.toISOString(), endDate: endDate.toISOString(), hasMore: false, records: [], checkedAt
    });
  }

  let transactionId = request.transactionId ?? null;
  if (!transactionId) {
    const subscription = await pool.query(`select original_transaction_id from billing_subscriptions
      where user_id = $1 and provider = 'apple' and environment = $2 and original_transaction_id is not null
      order by updated_at desc limit 1`, [userId, request.environment]);
    transactionId = subscription.rows[0]?.original_transaction_id ?? null;
  }
  if (!transactionId) throw new ApiError(404, "apple_notification_history_transaction_not_found", "Brugeren har ikke et Apple originalt transaktions-ID i denne kontekst.");

  const records: ReturnType<typeof compactRecord>[] = [];
  let paginationToken: string | undefined;
  let hasMore = false;
  for (let page = 0; page < 5; page += 1) {
    const body: Record<string, unknown> = paginationToken
      ? { paginationToken }
      : { startDate: startDate.getTime(), endDate: endDate.getTime(), transactionId };
    if (!paginationToken && request.onlyFailures) body.onlyFailures = true;
    const result = await requestHistory(request.environment, token, body);
    const items = Array.isArray(result.notificationHistory) ? result.notificationHistory : [];
    for (const item of items) if (item && typeof item === "object") records.push(compactRecord(item as Record<string, unknown>, request.includeRaw));
    hasMore = result.hasMore === true;
    paginationToken = typeof result.paginationToken === "string" ? result.paginationToken : undefined;
    if (!hasMore || !paginationToken) break;
  }

  return adminAppleNotificationHistoryResponseSchema.parse({
    configured: true, environment: request.environment, transactionId,
    startDate: startDate.toISOString(), endDate: endDate.toISOString(), hasMore, records, checkedAt
  });
}
