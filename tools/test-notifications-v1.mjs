import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  maintenanceDeadlineNotificationType,
  notificationDeduplicationKey,
  notificationDeepLink,
  resolveHouseNotificationRecipients
} from "../apps/api/src/notification-domain.ts";

test("deadline windows map only to V1 notification types", () => {
  assert.equal(maintenanceDeadlineNotificationType(7), "maintenance_task_due_soon");
  assert.equal(maintenanceDeadlineNotificationType(0), "maintenance_task_due_today");
  assert.equal(maintenanceDeadlineNotificationType(-1), "maintenance_task_overdue");
  assert.equal(maintenanceDeadlineNotificationType(-300), "maintenance_task_overdue");
  assert.equal(maintenanceDeadlineNotificationType(4), null);
});

test("due and overdue deduplication stays stable across retries and days", () => {
  const due = notificationDeduplicationKey("maintenance_task_due_today", "task_12345678", "usr_12345678", "2026-09-07");
  assert.equal(due, notificationDeduplicationKey("maintenance_task_due_today", "task_12345678", "usr_12345678", "2026-09-07"));
  const overdue = notificationDeduplicationKey("maintenance_task_overdue", "task_12345678", "usr_12345678", "2026-09-07");
  assert.notEqual(due, overdue);
  assert.equal(overdue, notificationDeduplicationKey("maintenance_task_overdue", "task_12345678", "usr_12345678", "2026-09-07"));
});

test("house recipients are active, individual and exclude the actor", () => {
  assert.deepEqual(resolveHouseNotificationRecipients([
    { userId: "a", status: "active", pushEnabled: true },
    { userId: "b", status: "active", pushEnabled: false },
    { userId: "c", status: "revoked", pushEnabled: true },
    { userId: "actor", status: "active" }
  ], "actor"), [
    { userId: "a", inApp: true, push: true },
    { userId: "b", inApp: true, push: false }
  ]);
});

test("actionable notification types map to entity-specific app routes", () => {
  assert.equal(notificationDeepLink("maintenance_task_due_soon", "house_12345678", "task_12345678"), "matriva://houses/house_12345678/maintenance/tasks/task_12345678");
  assert.equal(notificationDeepLink("maintenance_recommendation_created", "house_12345678", "mrec_12345678"), "matriva://houses/house_12345678/maintenance/recommendations/mrec_12345678");
  assert.equal(notificationDeepLink("house_invitation_received", "house_12345678", "invite_12345678"), "matriva://house-invitations/invite_12345678");
});

test("migration enforces notification, device and outbox idempotency", async () => {
  const sql = await readFile(new URL("../apps/api/src/migrations/0035_notifications_v1.sql", import.meta.url), "utf8");
  assert.match(sql, /unique index notifications_deduplication_key_uidx/);
  assert.match(sql, /unique \(user_id, device_id\)/);
  assert.match(sql, /unique index notification_devices_push_token_uidx/);
  assert.match(sql, /unique \(notification_id, device_id\)/);
  const adminSql = await readFile(new URL("../apps/api/src/migrations/0036_admin_notification_test_center_v1.sql", import.meta.url), "utf8");
  assert.match(adminSql, /permission_status text not null default 'unknown'/);
  assert.match(adminSql, /create table if not exists notification_admin_test_audit/);
});

test("notification deletion preserves deduplication keys", async () => {
  const dbSource = await readFile(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  const start = dbSource.indexOf("export async function deleteNotificationForUser");
  const end = dbSource.indexOf("export async function markAllNotificationsReadForUser", start);
  const deleteSource = dbSource.slice(start, end);
  assert.match(deleteSource, /set in_app_visible = false/);
  assert.doesNotMatch(deleteSource, /delete from notifications/);
});

test("house advisory locks cannot exhaust the API pool while waiting", async () => {
  const dbSource = await readFile(new URL("../apps/api/src/db.ts", import.meta.url), "utf8");
  assert.match(dbSource, /pg_try_advisory_lock\(hashtextextended/);
  assert.match(dbSource, /house_lock_timeout/);
  assert.match(dbSource, /setTimeout\(resolve, HOUSE_ADVISORY_LOCK_RETRY_MS\)/);
  assert.match(dbSource, /lockClient\.release\(destroyClient\)/);
  assert.doesNotMatch(dbSource, /pg_advisory_lock\(hashtextextended/);
});

test("notification item routes keep query parameters out of the id", async () => {
  const routes = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  assert.ok(routes.includes("([^/?]+)\\/read"));
  assert.ok(routes.includes("([^/?]+)(?:\\?.*)?$"));
});

test("admin test center stays on the production notification flow", async () => {
  const moduleSource = await readFile(new URL("../apps/api/src/admin-notifications.ts", import.meta.url), "utf8");
  const routes = await readFile(new URL("../apps/api/src/server.ts", import.meta.url), "utf8");
  assert.match(moduleSource, /createUserNotification\(pool/);
  assert.match(moduleSource, /bypassCategoryPreference: true/);
  assert.match(moduleSource, /targetDeviceId: input\.targetDeviceId/);
  assert.match(moduleSource, /admin_notification_no_devices/);
  assert.match(moduleSource, /admin_notification_device_disabled/);
  assert.match(moduleSource, /randomUUID\(\)/);
  assert.match(moduleSource, /return null;/);
  assert.match(moduleSource, /notification_admin_test_audit/);
  assert.doesNotMatch(moduleSource, /exp\.host|fetch\(/);
  assert.match(routes, /requireAdminUser\(getBearerToken\(request\)\)/);
});
