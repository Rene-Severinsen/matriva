import { randomUUID } from "node:crypto";

import type {
  AdminNotificationDestination,
  CreateAdminNotificationTestRequest
} from "@matriva/shared";

import {
  ApiError,
  createOpaqueId,
  createUserNotification,
  pool
} from "./db.ts";
import { notificationDeepLink } from "./notification-domain.ts";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function maskPushToken(token: string) {
  return token.length <= 8 ? "••••" : `${token.slice(0, Math.min(18, token.length - 4))}…${token.slice(-4)}`;
}

function deliveryStatus(row: { status: string; receipt_checked_at: Date | null; last_error: string | null }) {
  if (row.status === "sent" && row.receipt_checked_at && !row.last_error) return "receipt_ok";
  return row.status;
}

function overallStatus(deliveries: Array<{ status: string }>) {
  if (deliveries.some((delivery) => delivery.status === "invalid_token")) return "invalid_token" as const;
  if (deliveries.some((delivery) => delivery.status === "failed")) return "failed" as const;
  if (deliveries.some((delivery) => delivery.status === "sending")) return "sending" as const;
  if (deliveries.some((delivery) => delivery.status === "pending")) return "queued" as const;
  if (deliveries.length > 0 && deliveries.every((delivery) => delivery.status === "receipt_ok")) return "receipt_ok" as const;
  if (deliveries.length > 0 && deliveries.every((delivery) => delivery.status === "sent")) return "sent" as const;
  return "created" as const;
}

async function resolveDestination(userId: string, destination: AdminNotificationDestination) {
  switch (destination.kind) {
    case "none":
      return null;
    case "notification_center":
      return "matriva://notifications";
    case "sharing":
      return "matriva://more/sharing";
    case "house": {
      const result = await pool.query(
        `select 1 from house_memberships where house_id = $1 and user_id = $2 and status = 'active'`,
        [destination.houseId, userId]
      );
      if (!result.rowCount) throw new ApiError(400, "admin_notification_house_invalid", "Brugeren har ikke aktiv adgang til den valgte bolig.");
      return `matriva://houses/${destination.houseId}`;
    }
    case "maintenance_task": {
      const result = await pool.query(
        `select 1 from maintenance_tasks t join house_memberships hm on hm.house_id = t.house_id and hm.user_id = $2 and hm.status = 'active'
         where t.id = $1 and t.house_id = $3 and t.deleted_at is null`,
        [destination.taskId, userId, destination.houseId]
      );
      if (!result.rowCount) throw new ApiError(400, "admin_notification_task_invalid", "Opgaven findes ikke for brugerens bolig.");
      return notificationDeepLink("maintenance_task_due_today", destination.houseId, destination.taskId);
    }
    case "recommendation": {
      const result = await pool.query(
        `select 1 from maintenance_recommendations r join house_memberships hm on hm.house_id = r.house_id and hm.user_id = $2 and hm.status = 'active'
         where r.id = $1 and r.house_id = $3`,
        [destination.recommendationId, userId, destination.houseId]
      );
      if (!result.rowCount) throw new ApiError(400, "admin_notification_recommendation_invalid", "Anbefalingen findes ikke for brugerens bolig.");
      return notificationDeepLink("maintenance_recommendation_created", destination.houseId, destination.recommendationId);
    }
    case "invitation": {
      const result = await pool.query<{ email: string }>(
        `select i.email from house_invitations i join users u on u.id = $2 where i.id = $1 and lower(i.email) = lower(u.email)`,
        [destination.invitationId, userId]
      );
      if (!result.rowCount) throw new ApiError(400, "admin_notification_invitation_invalid", "Invitationen findes ikke for den valgte bruger.");
      return `matriva://house-invitations/${destination.invitationId}`;
    }
  }
}

async function getTestDeliveries(notificationId: string) {
  const result = await pool.query<{
    id: string; device_id: string; platform: "ios" | "android"; status: string; attempts: number;
    provider_ticket_id: string | null; last_error: string | null; last_attempt_at: Date | null;
    receipt_checked_at: Date | null;
  }>(
    `select o.id, o.device_id, d.platform, o.status, o.attempts, o.provider_ticket_id,
            o.last_error, o.last_attempt_at, o.receipt_checked_at
     from notification_push_outbox o join notification_devices d on d.id = o.device_id
     where o.notification_id = $1 order by o.created_at`,
    [notificationId]
  );
  return result.rows.map((row) => ({
    id: row.id, deviceId: row.device_id, platform: row.platform,
    status: deliveryStatus(row), attempts: row.attempts,
    providerTicketId: row.provider_ticket_id, lastError: row.last_error,
    lastAttemptAt: iso(row.last_attempt_at), receiptCheckedAt: iso(row.receipt_checked_at)
  }));
}

export async function listAdminNotificationDevices(userId: string) {
  const user = await pool.query<{ id: string; display_name: string | null; email: string }>(
    `select u.id, up.display_name, u.email from users u left join user_profiles up on up.user_id = u.id where u.id = $1`, [userId]
  );
  if (!user.rows[0]) throw new ApiError(404, "admin_notification_user_not_found", "Brugeren blev ikke fundet.");
  const devices = await pool.query(
    `select d.id, d.device_id, d.platform, d.enabled, d.app_version, d.permission_status, d.last_seen_at,
            (select o.status from notification_push_outbox o where o.device_id = d.id order by o.created_at desc limit 1) as latest_delivery_status,
            d.push_token
     from notification_devices d where d.user_id = $1 order by d.enabled desc, d.last_seen_at desc`,
    [userId]
  );
  return {
    user: { id: user.rows[0].id, displayName: user.rows[0].display_name, email: user.rows[0].email },
    devices: devices.rows.map((row) => ({
      id: row.id, deviceId: row.device_id, platform: row.platform, enabled: row.enabled,
      appVersion: row.app_version, permissionStatus: row.permission_status,
      lastSeenAt: row.last_seen_at.toISOString(), pushTokenMasked: maskPushToken(row.push_token),
      latestDeliveryStatus: row.latest_delivery_status
    }))
  };
}

export async function createAdminNotificationTest(adminUserId: string, input: CreateAdminNotificationTestRequest) {
  const targetUser = await pool.query<{ id: string; status: string }>("select id, status from users where id = $1", [input.targetUserId]);
  if (!targetUser.rows[0] || targetUser.rows[0].status !== "active") throw new ApiError(400, "admin_notification_user_inactive", "Brugeren er ikke aktiv.");
  const devices = await pool.query<{ id: string; enabled: boolean }>(
    `select id, enabled from notification_devices where user_id = $1`, [input.targetUserId]
  );
  if (!devices.rows.some((device) => device.enabled)) throw new ApiError(400, "admin_notification_no_devices", "Brugeren har ingen aktive push-enheder.");
  if (input.targetDeviceId) {
    const device = devices.rows.find((candidate) => candidate.id === input.targetDeviceId);
    if (!device) throw new ApiError(400, "admin_notification_device_invalid", "Det valgte device tilhører ikke brugeren.");
    if (!device.enabled) throw new ApiError(400, "admin_notification_device_disabled", "Det valgte device er deaktiveret.");
  }
  const deepLink = await resolveDestination(input.targetUserId, input.destination);
  const created = await createUserNotification(pool, {
    userId: input.targetUserId,
    type: "admin_test_push",
    category: "system",
    title: input.title.startsWith("TEST") ? input.title : `TEST · ${input.title}`,
    body: input.body,
    deepLink,
    priority: "normal",
    deduplicationKey: `admin_test_push:${randomUUID()}`,
    metadata: { test: true, adminActorUserId: adminUserId, targetUserId: input.targetUserId, targetDeviceId: input.targetDeviceId ?? null },
    bypassCategoryPreference: true,
    targetDeviceId: input.targetDeviceId ?? null
  });
  if (!created.notificationId) throw new ApiError(500, "admin_notification_create_failed", "Testnotifikationen kunne ikke oprettes.");
  await pool.query(
    `insert into notification_admin_test_audit (id, admin_user_id, target_user_id, target_device_id, notification_id, result_status)
     values ($1,$2,$3,$4,$5,$6)`,
    [createOpaqueId("nat"), adminUserId, input.targetUserId, input.targetDeviceId ?? null, created.notificationId, "queued"]
  );
  return getAdminNotificationTest(created.notificationId);
}

export async function getAdminNotificationTest(notificationId: string) {
  const result = await pool.query<{
    id: string; created_at: Date; title: string; body: string; user_id: string; target_device_id: string | null;
  }>(
    `select n.id, n.created_at, n.title, n.body, n.user_id, a.target_device_id
     from notifications n join notification_admin_test_audit a on a.notification_id = n.id
     where n.id = $1`, [notificationId]
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "admin_notification_test_not_found", "Testnotifikationen blev ikke fundet.");
  const deliveries = await getTestDeliveries(row.id);
  return {
    notificationId: row.id, createdAt: row.created_at.toISOString(), title: row.title, body: row.body,
    targetUserId: row.user_id, targetDeviceId: row.target_device_id,
    deliveries, status: overallStatus(deliveries)
  };
}

export async function listAdminNotificationTestHistory(limit = 20) {
  const result = await pool.query<{
    notification_id: string; created_at: Date; title: string; body: string; target_user_id: string;
    target_device_id: string | null; admin_user_id: string; admin_display_name: string | null;
    target_user_display_name: string | null; target_user_email: string; platform: "ios" | "android" | null;
  }>(
    `select a.notification_id, a.created_at, n.title, n.body, a.target_user_id, a.target_device_id,
            a.admin_user_id, admin_profile.display_name as admin_display_name,
            target_profile.display_name as target_user_display_name, target.email as target_user_email,
            selected_device.platform
     from notification_admin_test_audit a
     join notifications n on n.id = a.notification_id
     join users target on target.id = a.target_user_id
     left join user_profiles admin_profile on admin_profile.user_id = a.admin_user_id
     left join user_profiles target_profile on target_profile.user_id = a.target_user_id
     left join notification_devices selected_device on selected_device.id = a.target_device_id
     order by a.created_at desc limit $1`,
    [Math.max(1, Math.min(limit, 50))]
  );
  const tests = [];
  for (const row of result.rows) {
    const current = await getAdminNotificationTest(row.notification_id);
    tests.push({ ...current, adminUserId: row.admin_user_id, adminDisplayName: row.admin_display_name,
      targetUserDisplayName: row.target_user_display_name, targetUserEmail: row.target_user_email, platform: row.platform });
  }
  return { tests };
}
