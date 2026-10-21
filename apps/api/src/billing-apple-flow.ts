import { randomUUID } from "node:crypto";
import { ApiError, applyBillingSubscription, claimBillingEventRetry, createOpaqueId, createUserNotification, findBillingUserId, finishBillingEvent, getEntitlementsForUser, getUnmatchedAppleNotifications, recordBillingEvent, pool } from "./db.ts";
import { appleSubscriptionStatus, verifiedAppleRenewalFromJws, verifiedAppleTransactionFromJws, verifyAppleJws } from "./billing-apple.ts";
import type { AppleVerifiedRenewal, AppleVerifiedTransaction } from "./billing-apple.ts";
import type { UserId } from "@matriva/shared";
import type { NotificationType } from "@matriva/shared";

type Step = Record<string, unknown>;
const step = (name: string, result: string, detail?: string): Step => ({ name, result, at: new Date().toISOString(), ...(detail ? { detail } : {}) });
const signedDate = (value: unknown) => typeof value === "number" && Number.isFinite(value) && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;

function logBilling(input: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({ event: "apple_billing_processing", ...input }));
}

function subscriptionNotification(
  eventType: string,
  subtype: string | null,
  subscription: ReturnType<typeof subscriptionRecord>
): { type: NotificationType; title: string; body: string; priority: "normal" | "high" } | null {
  if (eventType === "SUBSCRIBED") {
    return { type: "subscription_purchased", title: "PRO er aktiveret", body: "Dit Matriva PRO-abonnement er nu aktiv.", priority: "normal" };
  }
  if (eventType === "DID_RENEW") {
    return { type: "subscription_renewed", title: "PRO er fornyet", body: "Dit Matriva PRO-abonnement er blevet fornyet.", priority: "normal" };
  }
  if (eventType === "DID_CHANGE_RENEWAL_STATUS" && subscription.autoRenew === false) {
    return { type: "subscription_cancelled", title: "PRO er opsagt", body: "Dit PRO-abonnement er opsagt, men din adgang fortsætter indtil udløbsdatoen.", priority: "normal" };
  }
  if (eventType === "DID_FAIL_TO_RENEW") {
    const inGracePeriod = subtype === "GRACE_PERIOD" || subscription.status === "grace_period";
    return { type: "subscription_billing_issue", title: "Problem med PRO-betalingen", body: inGracePeriod
      ? "Der er et problem med betalingen. Din PRO-adgang fortsætter midlertidigt."
      : "Der er et problem med betalingen. Opdatér dine betalingsoplysninger hos Apple.", priority: "high" };
  }
  if (eventType === "EXPIRED" || eventType === "GRACE_PERIOD_EXPIRED") {
    return { type: "subscription_expired", title: "PRO-adgangen er udløbet", body: "Dit Matriva PRO-abonnement er udløbet. Du har nu Free-adgang.", priority: "normal" };
  }
  if (eventType === "REFUND" || eventType === "REVOKE") {
    return { type: "subscription_refunded", title: "PRO-adgangen er fjernet", body: "Dit Matriva PRO-køb er blevet refunderet eller tilbagekaldt.", priority: "high" };
  }
  return null;
}

function subscriptionRecord(transaction: AppleVerifiedTransaction, userId: string, renewal: AppleVerifiedRenewal | null, notificationType: string | null, subtype: string | null, notificationUuid: string | null, appleSignedAt: string | null, serverStatus: number | null) {
  return {
    id: createOpaqueId("bsub"), userId: userId as UserId, provider: "apple" as const,
    providerSubscriptionId: transaction.transactionId, productId: transaction.productId,
    plan: "pro" as const, status: appleSubscriptionStatus(transaction, notificationType, subtype, renewal, serverStatus),
    environment: transaction.environment, originalTransactionId: transaction.originalTransactionId ?? transaction.transactionId,
    currentPeriodStartsAt: transaction.purchaseDate?.toISOString() ?? null,
    currentPeriodEndsAt: transaction.expiresDate?.toISOString() ?? null,
    autoRenew: renewal?.autoRenew ?? null,
    lastVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    autoRenewProductId: renewal?.autoRenewProductId ?? null,
    renewalDate: renewal?.renewalDate?.toISOString() ?? null, renewalPrice: renewal?.renewalPrice ?? null,
    currency: renewal?.currency ?? null, gracePeriodExpiresAt: renewal?.gracePeriodExpiresDate?.toISOString() ?? null,
    isInBillingRetryPeriod: renewal?.isInBillingRetryPeriod ?? null,
    expirationIntent: renewal?.expirationIntent ?? null, priceIncreaseStatus: renewal?.priceIncreaseStatus ?? null,
    lastAppleNotificationUuid: notificationUuid, lastAppleSignedAt: appleSignedAt
  };
}

async function processVerifiedEvent(input: {
  transaction: AppleVerifiedTransaction; renewal: AppleVerifiedRenewal | null;
  userId: string | null; eventType: string; subtype: string | null; providerEventId: string;
  signedPayload: string | null; signedTransactionInfo: string; signedRenewalInfo: string | null;
  notification: Record<string, unknown> | null; appleSignedAt: string | null;
  serverStatus: number | null;
}) {
  const started = Date.now();
  const correlationId = randomUUID();
  const { transaction, renewal, userId, eventType, subtype } = input;
  const steps: Step[] = [step("received", "ok"), step("payload_parsed", "ok"), step("apple_signature", "verified"),
    step("transaction_signature", "verified"), step("renewal_signature", renewal ? "verified" : "not_provided"),
    step("user_match", userId ? "matched" : "not_found")];
  const event = await recordBillingEvent({
    provider: "apple", environment: transaction.environment, providerEventId: input.providerEventId,
    eventType, providerSubscriptionId: transaction.transactionId,
    occurredAt: input.appleSignedAt ?? transaction.purchaseDate?.toISOString() ?? null,
    payload: input.notification ?? transaction.rawPayload
  }, userId, {
    subtype, appleSignedAt: input.appleSignedAt, originalTransactionId: transaction.originalTransactionId,
    productId: transaction.productId, signedPayload: input.signedPayload,
    signedTransactionInfo: input.signedTransactionInfo, signedRenewalInfo: input.signedRenewalInfo,
    decodedTransaction: transaction.rawPayload, decodedRenewal: renewal?.rawPayload ?? null,
    verification: { signedPayload: input.signedPayload !== null, signedTransactionInfo: true, signedRenewalInfo: renewal !== null },
    processingSteps: steps, correlationId
  });
  const fields = {
    correlationId, userId, notificationUuid: eventType === "PURCHASE_SYNC" ? null : input.providerEventId,
    eventType, subtype, environment: transaction.environment,
    transactionId: transaction.transactionId, originalTransactionId: transaction.originalTransactionId,
    retryCount: 0, durationMs: 0
  };
  if (event.duplicate && (event.processingStatus === "processed" || event.processingStatus === "ignored_older")) {
    logBilling({ ...fields, processingStatus: "duplicate", durationMs: Date.now() - started });
    return { accepted: true, duplicate: true, userId, transaction };
  }
  if (!event.id) throw new ApiError(500, "billing_event_missing", "Apple-hændelsen kunne ikke registreres.");
  if (event.duplicate) {
    const attempt = await claimBillingEventRetry(event.id, userId);
    if (attempt === null) {
      logBilling({ ...fields, processingStatus: "in_progress", durationMs: Date.now() - started });
      return { accepted: false, duplicate: true, userId, transaction };
    }
    fields.retryCount = attempt - 1;
    steps.push(step("retry", "started", `Forsøg ${attempt}.`));
  }
  if (!userId) {
    steps.push(step("subscription", "skipped", "Bruger kunne ikke identificeres."));
    steps.push(step("entitlement", "skipped", "Bruger kunne ikke identificeres."));
    await finishBillingEvent(event.id, "unmatched", steps, "user_not_found");
    logBilling({ ...fields, processingStatus: "unmatched", durationMs: Date.now() - started, errorType: "user_not_found" });
    return { accepted: false, duplicate: event.duplicate, userId, transaction };
  }
  try {
    const nextSubscription = subscriptionRecord(transaction, userId, renewal,
      eventType === "PURCHASE_SYNC" ? null : eventType, subtype,
      eventType === "PURCHASE_SYNC" ? null : input.providerEventId, input.appleSignedAt, input.serverStatus);
    const applied = await applyBillingSubscription(nextSubscription);
    steps.push(step("subscription_lookup", applied.foundExisting ? "found" : "not_found"));
    steps.push(step("subscription", applied.applied ? "updated" : "skipped", applied.applied ? applied.subscriptionId : applied.reason));
    steps.push(step("entitlement", applied.applied ? "updated" : "unchanged", applied.applied ? undefined : "Ældre Apple-hændelse."));
    const accessActive = ["active", "trial", "grace_period"].includes(nextSubscription.status) &&
      (!nextSubscription.currentPeriodEndsAt || new Date(nextSubscription.currentPeriodEndsAt) > new Date() ||
        nextSubscription.status === "grace_period" && Boolean(nextSubscription.gracePeriodExpiresAt && new Date(nextSubscription.gracePeriodExpiresAt) > new Date()));
    steps.push(step("pro_access", applied.applied ? accessActive ? "active" : "removed" : "unchanged"));
    if (applied.applied) {
      const notification = subscriptionNotification(eventType, subtype, nextSubscription);
      if (notification) {
        await createUserNotification(pool, {
          userId,
          houseId: null,
          type: notification.type,
          category: "system",
          title: notification.title,
          body: notification.body,
          entityType: "apple_subscription",
          entityId: transaction.originalTransactionId ?? transaction.transactionId,
          deepLink: "matriva://more/subscription",
          priority: notification.priority,
          deduplicationKey: `apple-subscription:${notification.type}:${input.providerEventId}:${userId}`
        });
      }
    }
    steps.push(step("completed", applied.applied ? "ok" : "ignored_older"));
    await finishBillingEvent(event.id, applied.applied ? "processed" : "ignored_older", steps);
    logBilling({ ...fields, processingStatus: applied.applied ? "processed" : "older_event", durationMs: Date.now() - started });
    return { accepted: true, duplicate: event.duplicate, userId, transaction };
  } catch (error) {
    const errorType = error instanceof ApiError ? error.code : "subscription_apply_failed";
    steps.push(step("subscription", "failed", errorType));
    steps.push(step("entitlement", "not_confirmed"));
    await finishBillingEvent(event.id, "failed", steps, errorType);
    logBilling({ ...fields, processingStatus: "failed", durationMs: Date.now() - started, errorType });
    throw error;
  }
}

export async function processApplePurchaseSync(userId: string, signedTransactionInfo: string, eventId: string | undefined) {
  const transaction = verifiedAppleTransactionFromJws(signedTransactionInfo);
  const owner = await findBillingUserId("apple", transaction.environment, transaction.transactionId, transaction.originalTransactionId);
  if (owner && owner !== userId) throw new ApiError(409, "billing_transaction_owned", "Apple-transaktionen er allerede knyttet til en anden konto.");
  const processed = await processVerifiedEvent({ transaction, renewal: null, userId, eventType: "PURCHASE_SYNC", subtype: null,
    providerEventId: eventId ?? transaction.transactionId, signedPayload: null, signedTransactionInfo,
    signedRenewalInfo: null, notification: null, appleSignedAt: transaction.signedDate?.toISOString() ?? null,
    serverStatus: null });
  if (processed.accepted && transaction.originalTransactionId) {
    try {
      const pending = await getUnmatchedAppleNotifications(transaction.environment, transaction.originalTransactionId);
      for (const signedPayload of pending) {
        try { await processAppleNotification(signedPayload); }
        catch (error) {
          logBilling({ correlationId: randomUUID(), userId, notificationUuid: null, eventType: "REPLAY_UNMATCHED",
            subtype: null, environment: transaction.environment, transactionId: transaction.transactionId,
            originalTransactionId: transaction.originalTransactionId, retryCount: 0, durationMs: 0,
            processingStatus: "failed", errorType: error instanceof ApiError ? error.code : "replay_failed" });
        }
      }
    } catch (error) {
      logBilling({ correlationId: randomUUID(), userId, notificationUuid: null, eventType: "REPLAY_UNMATCHED",
        subtype: null, environment: transaction.environment, transactionId: transaction.transactionId,
        originalTransactionId: transaction.originalTransactionId, retryCount: 0, durationMs: 0,
        processingStatus: "failed", errorType: error instanceof ApiError ? error.code : "replay_lookup_failed" });
    }
  }
  return {
    accepted: processed.accepted, duplicate: processed.duplicate, provider: "apple" as const,
    providerSubscriptionId: transaction.transactionId, entitlement: await getEntitlementsForUser(userId)
  };
}

async function processAppleNotificationVerified(signedPayload: string) {
  const notification = verifyAppleJws(signedPayload);
  const data = notification.data && typeof notification.data === "object" && !Array.isArray(notification.data)
    ? notification.data as Record<string, unknown> : null;
  if (notification.notificationType === "TEST") {
    const notificationUuid = typeof notification.notificationUUID === "string" ? notification.notificationUUID : null;
    const environment = data?.environment === "Sandbox" ? "sandbox" : data?.environment === "Production" ? "production" : null;
    if (!notificationUuid || !environment) throw new ApiError(400, "apple_notification_invalid", "Apple-testnotifikationen mangler miljø eller UUID.");
    const correlationId = randomUUID();
    const steps = [step("received", "ok"), step("apple_signature", "verified"), step("entitlement", "skipped", "Apple-testnotifikation")];
    const event = await recordBillingEvent({ provider: "apple", environment, providerEventId: notificationUuid,
      eventType: "TEST", providerSubscriptionId: null, occurredAt: signedDate(notification.signedDate),
      payload: notification }, null, { signedPayload, verification: { signedPayload: true },
        appleSignedAt: signedDate(notification.signedDate), processingSteps: steps, correlationId });
    if (event.id && !event.duplicate) await finishBillingEvent(event.id, "processed", steps);
    logBilling({ correlationId, userId: null, notificationUuid, eventType: "TEST", subtype: null,
      environment, transactionId: null, originalTransactionId: null, retryCount: 0, durationMs: 0,
      processingStatus: event.duplicate ? "duplicate" : "processed" });
    return { accepted: true, duplicate: event.duplicate };
  }
  const signedTransactionInfo = typeof data?.signedTransactionInfo === "string" ? data.signedTransactionInfo : null;
  if (!signedTransactionInfo) throw new ApiError(400, "apple_notification_invalid", "Apple-notifikationen mangler signedTransactionInfo.");
  const transaction = verifiedAppleTransactionFromJws(signedTransactionInfo);
  if ((typeof data?.environment === "string" && data.environment !== (transaction.environment === "sandbox" ? "Sandbox" : "Production")) ||
      (typeof data?.bundleId === "string" && data.bundleId !== transaction.bundleId)) {
    throw new ApiError(400, "apple_notification_invalid", "Apple-notifikationen matcher ikke transaktionens app eller miljø.");
  }
  const signedRenewalInfo = typeof data?.signedRenewalInfo === "string" ? data.signedRenewalInfo : null;
  const renewal = signedRenewalInfo ? verifiedAppleRenewalFromJws(signedRenewalInfo, transaction) : null;
  const userId = await findBillingUserId("apple", transaction.environment, transaction.transactionId, transaction.originalTransactionId);
  const notificationUuid = typeof notification.notificationUUID === "string" ? notification.notificationUUID : null;
  if (!notificationUuid) throw new ApiError(400, "apple_notification_invalid", "Apple-notifikationen mangler notificationUUID.");
  const safeNotification = { ...notification, data: data ? Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== "signedTransactionInfo" && key !== "signedRenewalInfo")
  ) : null };
  const processed = await processVerifiedEvent({ transaction, renewal, userId,
    eventType: typeof notification.notificationType === "string" ? notification.notificationType : "UNKNOWN",
    subtype: typeof notification.subtype === "string" ? notification.subtype : null,
    providerEventId: notificationUuid, signedPayload, signedTransactionInfo, signedRenewalInfo,
    notification: safeNotification, appleSignedAt: signedDate(notification.signedDate) ?? transaction.signedDate?.toISOString() ?? null,
    serverStatus: typeof data?.status === "number" ? data.status : null });
  return { accepted: processed.accepted, duplicate: processed.duplicate };
}

export async function processAppleNotification(signedPayload: string) {
  try { return await processAppleNotificationVerified(signedPayload); }
  catch (error) {
    const errorType = error instanceof ApiError ? error.code : "notification_processing_failed";
    logBilling({ correlationId: randomUUID(), userId: null, notificationUuid: null, eventType: "UNVERIFIED",
      subtype: null, environment: null, transactionId: null, originalTransactionId: null,
      retryCount: 0, durationMs: 0, processingStatus: "rejected", errorType });
    throw error;
  }
}
