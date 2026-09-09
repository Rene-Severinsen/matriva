declare const require: (id: string) => {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

const secureStore = require("expo-secure-store");
const maintenanceSwipeHintSeenKey = "maintenanceSwipeHintSeenV1";
const notificationSwipeHintSeenKey = "notificationSwipeHintSeenV1";

export async function readMaintenanceSwipeHintSeen(): Promise<boolean> {
  try {
    return (await secureStore.getItemAsync(maintenanceSwipeHintSeenKey)) === "true";
  } catch {
    return false;
  }
}

export async function markMaintenanceSwipeHintSeen(): Promise<void> {
  try {
    await secureStore.setItemAsync(maintenanceSwipeHintSeenKey, "true");
  } catch {
    // The hint is dismissed for the current session even if persistence fails.
  }
}

export async function readNotificationSwipeHintSeen(): Promise<boolean> {
  try {
    return (await secureStore.getItemAsync(notificationSwipeHintSeenKey)) === "true";
  } catch {
    return false;
  }
}

export async function markNotificationSwipeHintSeen(): Promise<void> {
  try {
    await secureStore.setItemAsync(notificationSwipeHintSeenKey, "true");
  } catch {
    // The hint is dismissed for the current session even if persistence fails.
  }
}
