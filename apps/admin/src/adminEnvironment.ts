const localApiBaseUrl = "http://127.0.0.1:4000";
const qaApiBaseUrl = "https://api-qa.matriva.dk";
const environmentStorageKey = "matriva.admin.environment.v1";

export type AdminEnvironmentKey = "local" | "qa" | "production";

export type AdminEnvironment = {
  key: AdminEnvironmentKey;
  label: "Lokal" | "QA" | "Produktion";
  badge: "LOKAL" | "QA" | "PROD";
  apiBaseUrl: string;
};

const configuredApiBaseUrl =
  import.meta.env.VITE_MATRIVA_ADMIN_API_BASE_URL?.trim() ||
  import.meta.env.VITE_MATRIVA_API_BASE_URL?.trim() ||
  localApiBaseUrl;

const localEnvironment: AdminEnvironment = {
  key: "local",
  label: "Lokal",
  badge: "LOKAL",
  apiBaseUrl: localApiBaseUrl
};

const qaEnvironment: AdminEnvironment = {
  key: "qa",
  label: "QA",
  badge: "QA",
  apiBaseUrl: qaApiBaseUrl
};

const lockedEnvironment: AdminEnvironment =
  configuredApiBaseUrl === localApiBaseUrl
    ? localEnvironment
    : configuredApiBaseUrl === qaApiBaseUrl
      ? qaEnvironment
      : {
          key: "production",
          label: "Produktion",
          badge: "PROD",
          apiBaseUrl: configuredApiBaseUrl
        };

export const adminEnvironmentOptions = [localEnvironment, qaEnvironment] as const;

export function allowsAdminEnvironmentSwitch() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_MATRIVA_ADMIN_ALLOW_ENVIRONMENT_SWITCH !== "false"
  );
}

export function resolveAdminEnvironment(): AdminEnvironment {
  if (!allowsAdminEnvironmentSwitch()) {
    return lockedEnvironment;
  }

  const stored = window.localStorage.getItem(environmentStorageKey);
  return stored === "qa" ? qaEnvironment : localEnvironment;
}

export function persistAdminEnvironment(environmentKey: AdminEnvironmentKey) {
  window.localStorage.setItem(environmentStorageKey, environmentKey);
}
