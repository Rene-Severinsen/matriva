import * as SecureStore from "expo-secure-store";

const notificationDeviceIdKey = "matriva.notification-device-id.v1";

function createDeviceId() {
  const random = Math.random().toString(36).slice(2);
  return `device_${Date.now().toString(36)}_${random}`;
}

export async function getOrCreateNotificationDeviceId() {
  const existing = await SecureStore.getItemAsync(notificationDeviceIdKey);
  if (existing) return existing;
  const created = createDeviceId();
  await SecureStore.setItemAsync(notificationDeviceIdKey, created);
  return created;
}

export function getNotificationDeviceId() {
  return SecureStore.getItemAsync(notificationDeviceIdKey);
}
