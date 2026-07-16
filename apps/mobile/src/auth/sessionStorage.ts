import type { SessionTokens } from "@matriva/shared";

declare const require: (id: string) => {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

const secureStore = require("expo-secure-store");
const sessionKey = "matriva.session.v1";

export async function readStoredSession(): Promise<SessionTokens | null> {
  const raw = await secureStore.getItemAsync(sessionKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionTokens;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function writeStoredSession(tokens: SessionTokens) {
  await secureStore.setItemAsync(sessionKey, JSON.stringify(tokens));
}

export async function clearStoredSession() {
  await secureStore.deleteItemAsync(sessionKey);
}
