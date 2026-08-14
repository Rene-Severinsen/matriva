export function normalizeAppIdentityValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const normalized = `${value}`.trim();
  return normalized || null;
}

export function formatAppVersionLabel(
  appVersion: string | null | undefined,
  appBuild: string | null | undefined
) {
  return `Version ${appVersion ?? "ukendt"} (${appBuild ?? "ukendt"})`;
}

export function nonProductionEnvironmentLabel(value: unknown): string | null {
  const normalized = normalizeAppIdentityValue(value)?.toUpperCase() ?? null;
  return normalized && normalized !== "PRODUCTION" ? normalized : null;
}
