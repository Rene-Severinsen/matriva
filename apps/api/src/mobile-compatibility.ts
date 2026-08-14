import type { AppCompatibility } from "@matriva/shared";

export const mobileAppVersionHeader = "x-matriva-app-version";
export const mobileAppBuildHeader = "x-matriva-app-build";

export type MobileClientIdentity = {
  appVersion: string | null;
  appBuild: number | null;
};

export type MobileCompatibilityPolicy = {
  minimumSupportedAppVersion: string | null;
  minimumSupportedAppBuild: number | null;
  updateUrl: string | null;
};

type HeaderValue = string | string[] | undefined;
type CompatibilityEnvironment = Record<string, string | undefined>;

function firstHeaderValue(value: HeaderValue) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() || null;
}

function parseBuild(value: string | null) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseVersion(value: string | null) {
  return value && /^\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(value)
    ? value
    : null;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[.+-]/, 1)[0]!.split(".").map(Number);
  const rightParts = right.split(/[.+-]/, 1)[0]!.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function mobileClientIdentityFromHeaders(
  headers: Record<string, HeaderValue>
): MobileClientIdentity {
  return {
    appVersion: parseVersion(firstHeaderValue(headers[mobileAppVersionHeader])),
    appBuild: parseBuild(firstHeaderValue(headers[mobileAppBuildHeader]))
  };
}

export function mobileCompatibilityPolicyFromEnvironment(
  environment: CompatibilityEnvironment = process.env
): MobileCompatibilityPolicy {
  const minimumSupportedAppVersion = parseVersion(
    environment.MATRIVA_MIN_SUPPORTED_APP_VERSION?.trim() || null
  );
  const minimumSupportedAppBuild = parseBuild(
    environment.MATRIVA_MIN_SUPPORTED_APP_BUILD?.trim() || null
  );
  const configuredUpdateUrl = environment.MATRIVA_APP_UPDATE_URL?.trim() || null;

  return {
    minimumSupportedAppVersion,
    minimumSupportedAppBuild,
    updateUrl: configuredUpdateUrl && /^https?:\/\//.test(configuredUpdateUrl)
      ? configuredUpdateUrl
      : null
  };
}

export function evaluateMobileCompatibility(
  client: MobileClientIdentity,
  policy: MobileCompatibilityPolicy
): AppCompatibility {
  const versionUnsupported = Boolean(
    client.appVersion &&
    policy.minimumSupportedAppVersion &&
    compareVersions(client.appVersion, policy.minimumSupportedAppVersion) < 0
  );
  const buildUnsupported = Boolean(
    client.appBuild !== null &&
    policy.minimumSupportedAppBuild !== null &&
    client.appBuild < policy.minimumSupportedAppBuild
  );

  return {
    status: versionUnsupported || buildUnsupported ? "upgrade_required" : "supported",
    minimumSupportedAppVersion: policy.minimumSupportedAppVersion,
    minimumSupportedAppBuild: policy.minimumSupportedAppBuild,
    reason: versionUnsupported ? "minimum_app_version" : buildUnsupported ? "minimum_app_build" : null,
    updateUrl: policy.updateUrl
  };
}
