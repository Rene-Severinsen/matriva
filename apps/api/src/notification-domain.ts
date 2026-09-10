import type { NotificationType } from "@matriva/shared";

const maintenanceDeadlineNotificationTypes = new Set<NotificationType>([
  "maintenance_task_due_soon",
  "maintenance_task_due_today",
  "maintenance_task_overdue"
]);

export function notificationDeduplicationKey(
  type: NotificationType,
  entityId: string,
  userId: string,
  eventWindow: string
) {
  return `${type}:${entityId}:${userId}:${eventWindow}`;
}

export function maintenanceDeadlineNotificationType(daysUntilDue: number): NotificationType | null {
  if (daysUntilDue === 7) return "maintenance_task_due_soon";
  if (daysUntilDue === 0) return "maintenance_task_due_today";
  if (daysUntilDue < 0) return "maintenance_task_overdue";
  return null;
}

export function isMaintenanceDeadlineNotificationType(type: NotificationType) {
  return maintenanceDeadlineNotificationTypes.has(type);
}

export function isMaintenanceDeadlinePushWindowOpen(
  now = new Date(),
  timeZone = "Europe/Copenhagen"
) {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return Number(hourPart ?? 0) >= 8;
}

export function resolveHouseNotificationRecipients(
  memberships: Array<{ userId: string; status: "active" | "revoked"; inAppEnabled?: boolean; pushEnabled?: boolean }>,
  actorUserId?: string | null
) {
  return memberships
    .filter((membership) => membership.status === "active" && membership.userId !== actorUserId)
    .map((membership) => ({
      userId: membership.userId,
      inApp: membership.inAppEnabled ?? true,
      push: membership.pushEnabled ?? true
    }));
}

export function notificationDeepLink(type: NotificationType, houseId: string, entityId: string) {
  if (type.startsWith("maintenance_task_")) return `matriva://houses/${houseId}/maintenance/tasks/${entityId}`;
  if (type === "maintenance_recommendation_created") return `matriva://houses/${houseId}/maintenance/recommendations/${entityId}`;
  if (type === "house_invitation_received") return `matriva://house-invitations/${entityId}`;
  if (type === "house_invitation_accepted" || type === "house_access_requested") return `matriva://houses/${houseId}/access`;
  if (type === "house_access_request_approved") return `matriva://houses/${houseId}`;
  return "matriva://more/sharing";
}
