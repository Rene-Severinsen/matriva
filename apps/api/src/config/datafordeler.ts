type DatafordelerAuthMode = "api_key" | "oauth" | "missing" | "unsupported";

type DatafordelerConfigStatus = {
  available: boolean;
  authMode: DatafordelerAuthMode;
  graphqlUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  liveIntegrationImplemented: boolean;
  reason: string;
};

export const DATAFORDELER_DEFAULT_GRAPHQL_URL =
  "https://graphql.datafordeler.dk/flexibleCurrent/v1";

const supportedAuthModes = new Set(["api_key"]);

function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && normalizeEnvValue(value).length > 0;
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  const quote = trimmed[0];

  if (
    trimmed.length >= 2 &&
    (quote === "\"" || quote === "'") &&
    trimmed.endsWith(quote)
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function isSupportedAuthMode(
  value: string
): value is Exclude<DatafordelerAuthMode, "missing" | "unsupported"> {
  return supportedAuthModes.has(value);
}

export function getDatafordelerConfigStatus(): DatafordelerConfigStatus {
  const authModeValue = process.env.DATAFORDELER_AUTH_MODE ?? "api_key";
  const graphqlUrlConfigured = true;
  const apiKeyConfigured = isConfigured(process.env.DATAFORDELER_API_KEY);

  if (!isConfigured(authModeValue)) {
    return {
      available: false,
      authMode: "missing",
      graphqlUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler auth mode is missing."
    };
  }

  if (!isSupportedAuthMode(authModeValue)) {
    return {
      available: false,
      authMode: "unsupported",
      graphqlUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler auth mode is unsupported."
    };
  }

  if (!graphqlUrlConfigured || !apiKeyConfigured) {
    return {
      available: false,
      authMode: authModeValue,
      graphqlUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler credentials are missing or incomplete."
    };
  }

  return {
    available: true,
    authMode: authModeValue,
    graphqlUrlConfigured,
    apiKeyConfigured,
    liveIntegrationImplemented: true,
    reason: "Datafordeler GraphQL integration is configured."
  };
}

export function getDatafordelerRuntimeConfig() {
  const apiKey = normalizeEnvValue(process.env.DATAFORDELER_API_KEY);

  if (!apiKey) {
    throw new Error("DATAFORDELER_API_KEY is required for public data enrichment.");
  }

  return {
    graphqlUrl:
      normalizeEnvValue(process.env.DATAFORDELER_GRAPHQL_URL) ||
      DATAFORDELER_DEFAULT_GRAPHQL_URL,
    apiKey,
    timeoutMs: Number.parseInt(
      process.env.DATAFORDELER_TIMEOUT_MS ?? "8000",
      10
    )
  };
}
