import assert from "node:assert/strict";
import { createSign, randomUUID, X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("verified Apple evidence updates entitlement and supports a complete admin timeline", async () => {
  assert.ok(process.env.DATABASE_URL, "Set DATABASE_URL to an isolated or confirmed local DEV database");
  const directory = await mkdtemp(join(tmpdir(), "matriva-billing-test-"));
  const keyPath = join(directory, "test-key.pem");
  const certPath = join(directory, "test-cert.pem");
  const openssl = spawnSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1",
    "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=Matriva Local Billing Test"], { encoding: "utf8" });
  assert.equal(openssl.status, 0, openssl.stderr);
  const key = await readFile(keyPath, "utf8");
  const cert = new X509Certificate(await readFile(certPath));
  process.env.MATRIVA_APPLE_ROOT_CERT_SHA256 = cert.fingerprint256;
  const x5c = cert.raw.toString("base64");
  const signed = (payload) => {
    const head = Buffer.from(JSON.stringify({ alg: "ES256", x5c: [x5c] })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signer = createSign("SHA256"); signer.update(`${head}.${body}`); signer.end();
    return `${head}.${body}.${signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  const { pool, createSessionForUser } = await import("../apps/api/src/db.ts");
  const { processApplePurchaseSync, processAppleNotification } = await import("../apps/api/src/billing-apple-flow.ts");
  const { getAdminBillingAudit, getAdminBillingEventDetail, auditAdminBillingPayloadAction } = await import("../apps/api/src/admin-billing.ts");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const userId = `usr_billtest_${suffix}`;
  const otherUserId = `usr_billother_${suffix}`;
  const originalTransactionId = `test-original-${suffix}`;
  const transactionId = `test-transaction-${suffix}`;
  const purchaseEventId = `test-purchase-${suffix}`;
  const renewalEventId = `test-renewal-${suffix}`;
  const expiredEventId = `test-expired-${suffix}`;
  const graceEventId = `test-grace-${suffix}`;
  const recoveryEventId = `test-recovery-${suffix}`;
  const refundEventId = `test-refund-${suffix}`;
  const testEventId = `test-webhook-${suffix}`;
  const reversedEventId = `test-reversed-${suffix}`;
  const oldEventId = `test-old-${suffix}`;
  const revokeEventId = `test-revoke-${suffix}`;
  const unmatchedEventId = `test-unmatched-${suffix}`;
  const replayEventId = `test-replay-${suffix}`;
  const legacyEventId = `test-legacy-${suffix}`;
  const now = Date.now();
  const txn = signed({ transactionId, originalTransactionId, productId: "matriva.pro.monthly",
    bundleId: "dk.matriva.app", environment: "Sandbox", purchaseDate: now - 1000,
    expiresDate: now + 86_400_000, signedDate: now, transactionReason: "PURCHASE" });
  const renewal = signed({ originalTransactionId, environment: "Sandbox", productId: "matriva.pro.monthly",
    autoRenewStatus: 0, autoRenewProductId: "matriva.pro.monthly", renewalDate: now + 86_400_000 });
  try {
    await pool.query("insert into users (id, email) values ($1, $2), ($3, $4)",
      [userId, `${suffix}@billing-test.invalid`, otherUserId, `${suffix}-other@billing-test.invalid`]);
    const { requireAdminUser } = await import("../apps/api/src/admin.ts");
    const nonAdminSession = await createSessionForUser(otherUserId);
    await assert.rejects(requireAdminUser(nonAdminSession.accessToken), { code: "admin_forbidden" },
      "Raw payload endpoints must reject a valid user without SUPER_ADMIN");
    const { verifiedAppleTransactionFromJws } = await import("../apps/api/src/billing-apple.ts");
    const yearly = signed({ transactionId: `test-yearly-${suffix}`, originalTransactionId: `test-yearly-${suffix}`,
      productId: "matriva.pro.yearly", bundleId: "dk.matriva.app", environment: "Sandbox" });
    assert.equal(verifiedAppleTransactionFromJws(yearly).productId, "matriva.pro.yearly");
    const production = signed({ transactionId: `test-production-${suffix}`, originalTransactionId: `test-production-${suffix}`,
      productId: "matriva.pro.monthly", bundleId: "dk.matriva.app", environment: "Production" });
    assert.equal(verifiedAppleTransactionFromJws(production).environment, "production");
    process.env.MATRIVA_APPLE_ENVIRONMENT = "sandbox";
    assert.throws(() => verifiedAppleTransactionFromJws(production), { code: "apple_environment_invalid" });
    delete process.env.MATRIVA_APPLE_ENVIRONMENT;
    await assert.rejects(processAppleNotification(`${signed({ notificationType: "TEST" }).slice(0, -2)}aa`), { code: "apple_signed_payload_invalid" });
    await assert.rejects(processAppleNotification(signed({ notificationUUID: `test-missing-${suffix}`, notificationType: "DID_RENEW" })), { code: "apple_notification_invalid" });
    const testWebhook = signed({ notificationUUID: testEventId, notificationType: "TEST", signedDate: now,
      data: { environment: "Sandbox", bundleId: "dk.matriva.app" } });
    assert.equal((await processAppleNotification(testWebhook)).accepted, true);
    const unmatchedTxn = signed({ transactionId: `test-unmatched-txn-${suffix}`, originalTransactionId: `test-unmatched-original-${suffix}`,
      productId: "matriva.pro.monthly", bundleId: "dk.matriva.app", environment: "Sandbox", purchaseDate: now });
    const unmatched = signed({ notificationUUID: unmatchedEventId, notificationType: "SUBSCRIBED", signedDate: now,
      data: { environment: "Sandbox", signedTransactionInfo: unmatchedTxn } });
    assert.equal((await processAppleNotification(unmatched)).accepted, false);
    const unmatchedRow = await pool.query("select processing_status from billing_events where provider_event_id = $1", [unmatchedEventId]);
    assert.equal(unmatchedRow.rows[0].processing_status, "unmatched");
    const earlyNotification = signed({ notificationUUID: replayEventId, notificationType: "SUBSCRIBED", signedDate: now + 500,
      data: { environment: "Sandbox", signedTransactionInfo: txn } });
    assert.equal((await processAppleNotification(earlyNotification)).accepted, false);
    const purchase = await processApplePurchaseSync(userId, txn, purchaseEventId);
    assert.equal(purchase.accepted, true);
    assert.equal(purchase.entitlement.accessPlan, "pro");
    const replayed = await pool.query("select processing_status, processing_attempt_count, user_id from billing_events where provider_event_id = $1", [replayEventId]);
    assert.deepEqual(replayed.rows[0], { processing_status: "processed", processing_attempt_count: 2, user_id: userId });
    assert.equal((await processApplePurchaseSync(userId, txn, purchaseEventId)).duplicate, true);
    await assert.rejects(processApplePurchaseSync(otherUserId, txn, `test-stolen-${suffix}`), { code: "billing_transaction_owned" });

    const notification = signed({ notificationUUID: renewalEventId, notificationType: "DID_CHANGE_RENEWAL_STATUS",
      subtype: "AUTO_RENEW_DISABLED", signedDate: now + 1000,
      data: { signedTransactionInfo: txn, signedRenewalInfo: renewal } });
    assert.deepEqual(await processAppleNotification(notification), { accepted: true, duplicate: false });
    const activeAudit = await getAdminBillingAudit(userId);
    assert.equal(activeAudit.subscriptions[0].autoRenew, false);
    assert.equal(activeAudit.subscriptions[0].status, "active");
    assert.equal(activeAudit.events[0].subtype, "AUTO_RENEW_DISABLED");
    assert.ok(!JSON.stringify(activeAudit).includes(notification), "Normal list response must not include raw JWS");
    const detail = await getAdminBillingEventDetail(userId, activeAudit.events[0].id, userId);
    assert.equal(detail.signedPayload, notification);
    assert.equal(detail.signedTransactionInfo, txn);
    assert.equal(detail.signedRenewalInfo, renewal);
    assert.equal(detail.renewal?.autoRenewStatus, 0);
    assert.equal(detail.processingStatus, "processed");
    assert.equal(detail.verification.signedRenewalInfo, true);
    assert.ok(detail.processingSteps.some(step => step.name === "entitlement" && step.result === "updated"));
    await assert.rejects(getAdminBillingEventDetail(otherUserId, detail.id, otherUserId), { code: "billing_event_not_found" });
    await auditAdminBillingPayloadAction(userId, detail.id, userId, "download");
    const accesses = await pool.query("select action from billing_payload_access_audit where billing_event_id = $1 order by id", [detail.id]);
    assert.deepEqual(accesses.rows.map(row => row.action), ["view", "download"]);

    const graceRenewal = signed({ originalTransactionId, environment: "Sandbox", productId: "matriva.pro.monthly",
      autoRenewStatus: 1, gracePeriodExpiresDate: now + 43_200_000, isInBillingRetryPeriod: true });
    const graceTxn = signed({ transactionId, originalTransactionId, productId: "matriva.pro.monthly",
      bundleId: "dk.matriva.app", environment: "Sandbox", purchaseDate: now - 86_400_000,
      expiresDate: now - 1000, signedDate: now + 1100 });
    const grace = signed({ notificationUUID: graceEventId, notificationType: "DID_FAIL_TO_RENEW", subtype: "GRACE_PERIOD",
      signedDate: now + 1100, data: { signedTransactionInfo: graceTxn, signedRenewalInfo: graceRenewal } });
    assert.equal((await processAppleNotification(grace)).accepted, true);
    assert.equal((await getAdminBillingAudit(userId)).subscriptions[0].status, "grace_period");
    const { getEntitlementsForUser } = await import("../apps/api/src/db.ts");
    assert.equal((await getEntitlementsForUser(userId)).accessPlan, "pro", "Grace-period access must survive the preceding transaction expiration");
    const recoveredTxn = signed({ transactionId: `test-recovered-${suffix}`, originalTransactionId,
      productId: "matriva.pro.monthly", bundleId: "dk.matriva.app", environment: "Sandbox",
      purchaseDate: now + 1200, expiresDate: now + 2 * 86_400_000, signedDate: now + 1200 });
    const recovered = signed({ notificationUUID: recoveryEventId, notificationType: "DID_RENEW", subtype: "BILLING_RECOVERY",
      signedDate: now + 1300, data: { signedTransactionInfo: recoveredTxn, signedRenewalInfo: graceRenewal } });
    assert.equal((await processAppleNotification(recovered)).accepted, true);
    assert.equal((await getAdminBillingAudit(userId)).subscriptions[0].status, "active");

    const expiredTxn = signed({ transactionId: `test-recovered-${suffix}`, originalTransactionId, productId: "matriva.pro.monthly",
      bundleId: "dk.matriva.app", environment: "Sandbox", purchaseDate: now - 86_400_000,
      expiresDate: now - 1000, signedDate: now + 1500 });
    const expired = signed({ notificationUUID: expiredEventId, notificationType: "EXPIRED", subtype: "VOLUNTARY",
      signedDate: now + 2000, data: { signedTransactionInfo: expiredTxn } });
    assert.equal((await processAppleNotification(expired)).accepted, true);
    const endedAudit = await getAdminBillingAudit(userId);
    assert.equal(endedAudit.subscriptions[0].status, "expired");
    assert.equal(endedAudit.subscriptions[0].autoRenew, true, "Missing renewal data must preserve known auto-renew status");
    assert.equal((await getEntitlementsForUser(userId)).accessPlan, "free");

    const refunded = signed({ notificationUUID: refundEventId, notificationType: "REFUND", signedDate: now + 3000,
      data: { signedTransactionInfo: expiredTxn } });
    assert.equal((await processAppleNotification(refunded)).accepted, true);
    assert.equal((await getAdminBillingAudit(userId)).subscriptions[0].status, "refunded_revoked");
    assert.equal((await processAppleNotification(notification)).duplicate, true);
    assert.equal((await getAdminBillingAudit(userId)).subscriptions[0].status, "refunded_revoked");
    const reversedTxn = signed({ transactionId: `test-recovered-${suffix}`, originalTransactionId,
      productId: "matriva.pro.monthly", bundleId: "dk.matriva.app", environment: "Sandbox",
      purchaseDate: now + 1200, expiresDate: now + 2 * 86_400_000, signedDate: now + 3500 });
    const reversed = signed({ notificationUUID: reversedEventId, notificationType: "REFUND_REVERSED", signedDate: now + 3500,
      data: { status: 1, signedTransactionInfo: reversedTxn } });
    assert.equal((await processAppleNotification(reversed)).accepted, true);
    assert.equal((await getEntitlementsForUser(userId)).accessPlan, "pro");
    const old = signed({ notificationUUID: oldEventId, notificationType: "DID_FAIL_TO_RENEW", signedDate: now + 2400,
      data: { signedTransactionInfo: expiredTxn } });
    assert.equal((await processAppleNotification(old)).accepted, true);
    const afterOld = await getAdminBillingAudit(userId);
    assert.equal(afterOld.events[0].processingStatus, "ignored_older");
    assert.equal(afterOld.subscriptions[0].status, "active");
    const revoke = signed({ notificationUUID: revokeEventId, notificationType: "REVOKE", signedDate: now + 4000,
      data: { status: 5, signedTransactionInfo: reversedTxn } });
    assert.equal((await processAppleNotification(revoke)).accepted, true);
    assert.equal((await getEntitlementsForUser(userId)).accessPlan, "free");

    await pool.query(`insert into billing_events (provider, environment, provider_event_id, event_type, user_id, payload)
      values ('apple', 'sandbox', $1, 'PURCHASE_SYNC', $2, '{}'::jsonb)`, [legacyEventId, userId]);
    const legacyAudit = await getAdminBillingAudit(userId);
    const legacy = legacyAudit.events.find(event => event.eventId === legacyEventId);
    assert.equal(legacy?.processingStatus, "legacy_unknown");
    const legacyDetail = await getAdminBillingEventDetail(userId, legacy.id, userId);
    assert.equal(legacyDetail.signedPayload, null);
    assert.equal(legacyDetail.processingSteps.length, 0);
    const olderPage = await getAdminBillingAudit(userId, legacy.id);
    assert.ok(olderPage.events.every(event => BigInt(event.id) < BigInt(legacy.id)));
    await pool.query(`insert into user_entitlements (user_id, plan, status, source)
      values ($1, 'pro', 'active', 'complimentary')`, [otherUserId]);
    assert.equal((await getAdminBillingAudit(otherUserId)).subscriptions.length, 0,
      "A complimentary grant must not be presented as an Apple purchase");
  } finally {
    await pool.query("delete from billing_events where provider_event_id = any($1::text[])",
      [[purchaseEventId, renewalEventId, graceEventId, recoveryEventId, expiredEventId, refundEventId,
        reversedEventId, oldEventId, revokeEventId, unmatchedEventId, replayEventId, legacyEventId, testEventId]]);
    await pool.query("delete from users where id = any($1::text[])", [[userId, otherUserId]]);
    await pool.end();
    await rm(directory, { recursive: true, force: true });
  }
});
