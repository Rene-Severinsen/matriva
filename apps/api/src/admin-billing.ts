import { adminBillingAuditSchema, adminBillingEventDetailSchema } from "@matriva/shared";
import { ApiError, pool } from "./db.ts";

const date = (value: Date | null) => value ? new Date(value).toISOString() : null;
const eventBelongsToUser = `(
  e.user_id = $1 or (e.user_id is null and exists (
    select 1 from billing_subscriptions s where s.user_id = $1
      and s.provider = e.provider and s.environment = e.environment
      and (s.provider_subscription_id = e.provider_subscription_id
        or (e.original_transaction_id is not null and s.original_transaction_id = e.original_transaction_id)
        or s.original_transaction_id = e.payload->>'originalTransactionId')
  ))
)`;

export async function getAdminBillingAudit(userId: string, beforeId: string | null = null) {
  const [subscriptions, events] = await Promise.all([
    pool.query(`select id, provider, environment, product_id, status, original_transaction_id,
      provider_subscription_id, current_period_starts_at, current_period_ends_at,
      auto_renew, last_verified_at, created_at, updated_at, auto_renew_product_id,
      renewal_date, grace_period_expires_at, is_in_billing_retry_period, expiration_intent,
      last_apple_notification_uuid, last_apple_signed_at
      from billing_subscriptions where user_id = $1
      order by updated_at desc, id`, [userId]),
    pool.query(`select e.id::text, e.provider, e.environment, e.provider_event_id, e.event_type,
      e.provider_subscription_id, e.occurred_at, e.created_at, e.processed_at, e.processing_error,
      e.notification_subtype, e.apple_signed_at, e.original_transaction_id, e.product_id,
      e.processing_status, e.processing_attempt_count, e.correlation_id,
      (select s.id from billing_subscriptions s where s.user_id = $1
       and s.provider = e.provider and s.environment = e.environment
       and (s.original_transaction_id = e.original_transaction_id or s.provider_subscription_id = e.provider_subscription_id)
       order by s.updated_at desc limit 1) as subscription_id
      from billing_events e
      where ${eventBelongsToUser} and ($2::bigint is null or e.id < $2::bigint)
      order by e.id desc limit 101`, [userId, beforeId])
  ]);
  const page = events.rows.slice(0, 100);
  return adminBillingAuditSchema.parse({
    subscriptions: subscriptions.rows.map(s => ({
      id: s.id, provider: s.provider, environment: s.environment, productId: s.product_id,
      status: s.status, originalTransactionId: s.original_transaction_id,
      transactionId: s.provider_subscription_id, periodStartsAt: date(s.current_period_starts_at),
      periodEndsAt: date(s.current_period_ends_at), autoRenew: s.auto_renew,
      lastVerifiedAt: date(s.last_verified_at), createdAt: date(s.created_at), updatedAt: date(s.updated_at),
      autoRenewProductId: s.auto_renew_product_id, renewalDate: date(s.renewal_date),
      gracePeriodExpiresAt: date(s.grace_period_expires_at), isInBillingRetryPeriod: s.is_in_billing_retry_period,
      expirationIntent: s.expiration_intent, lastAppleNotificationUuid: s.last_apple_notification_uuid,
      lastAppleSignedAt: date(s.last_apple_signed_at)
    })),
    events: page.map(e => ({
      id: e.id, provider: e.provider, environment: e.environment, eventId: e.provider_event_id,
      eventType: e.event_type, transactionId: e.provider_subscription_id,
      occurredAt: date(e.occurred_at), receivedAt: date(e.created_at),
      processedAt: date(e.processed_at), processingError: e.processing_error,
      subtype: e.notification_subtype, appleSignedAt: date(e.apple_signed_at),
      originalTransactionId: e.original_transaction_id, productId: e.product_id,
      subscriptionId: e.subscription_id, processingStatus: e.processing_status,
      processingAttemptCount: e.processing_attempt_count, correlationId: e.correlation_id
    })), eventLimit: 100, nextBeforeId: events.rows.length > 100 ? page.at(-1)?.id ?? null : null
  });
}

export async function getAdminBillingEventDetail(userId: string, eventId: string, actorUserId: string) {
  if (!/^\d+$/.test(eventId)) throw new ApiError(400, "billing_event_invalid", "Hændelses-ID er ugyldigt.");
  const result = await pool.query(`select e.* from billing_events e where e.id = $2 and ${eventBelongsToUser}`, [userId, eventId]);
  const e = result.rows[0];
  if (!e) throw new ApiError(404, "billing_event_not_found", "Hændelsen blev ikke fundet for denne bruger.");
  await pool.query(`insert into billing_payload_access_audit (actor_user_id, target_user_id, billing_event_id, action)
    values ($1, $2, $3, 'view')`, [actorUserId, userId, eventId]);
  const legacyPayload = e.payload && typeof e.payload === "object" ? e.payload as Record<string, unknown> : null;
  return adminBillingEventDetailSchema.parse({
    id: String(e.id), userId: e.user_id, eventType: e.event_type, subtype: e.notification_subtype,
    environment: e.environment, eventId: e.provider_event_id, receivedAt: date(e.created_at),
    appleSignedAt: date(e.apple_signed_at), occurredAt: date(e.occurred_at), processedAt: date(e.processed_at),
    processingStatus: e.processing_status, processingError: e.processing_error,
    processingAttemptCount: e.processing_attempt_count, correlationId: e.correlation_id,
    transaction: e.decoded_transaction ?? (e.event_type === "PURCHASE_SYNC" ? legacyPayload : null),
    renewal: e.decoded_renewal, notification: e.event_type === "PURCHASE_SYNC" ? null : legacyPayload,
    verification: e.verification ?? {}, processingSteps: e.processing_steps ?? [],
    signedPayload: e.raw_signed_payload, signedTransactionInfo: e.raw_signed_transaction_info,
    signedRenewalInfo: e.raw_signed_renewal_info
  });
}

export async function auditAdminBillingPayloadAction(userId: string, eventId: string, actorUserId: string, action: "copy_raw" | "copy_decoded" | "download") {
  if (!/^\d+$/.test(eventId)) throw new ApiError(400, "billing_event_invalid", "Hændelses-ID er ugyldigt.");
  const result = await pool.query(`insert into billing_payload_access_audit (actor_user_id, target_user_id, billing_event_id, action)
    select $3, $1, e.id, $4 from billing_events e where e.id = $2 and ${eventBelongsToUser}
    returning id`, [userId, eventId, actorUserId, action]);
  if (!result.rowCount) throw new ApiError(404, "billing_event_not_found", "Hændelsen blev ikke fundet for denne bruger.");
}
