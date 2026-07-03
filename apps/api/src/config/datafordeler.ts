type DatafordelerAuthMode = "api_key" | "oauth" | "missing" | "unsupported";

type DatafordelerConfigStatus = {
  available: boolean;
  authMode: DatafordelerAuthMode;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  liveIntegrationImplemented: false;
  reason: string;
};

const supportedAuthModes = new Set(["api_key", "oauth"]);

function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSupportedAuthMode(
  value: string
): value is Exclude<DatafordelerAuthMode, "missing" | "unsupported"> {
  return supportedAuthModes.has(value);
}

export function getDatafordelerConfigStatus(): DatafordelerConfigStatus {
  const authModeValue = process.env.DATAFORDELER_AUTH_MODE;
  const baseUrlConfigured = isConfigured(process.env.DATAFORDELER_BASE_URL);
  const apiKeyConfigured = isConfigured(process.env.DATAFORDELER_API_KEY);

  if (!isConfigured(authModeValue)) {
    return {
      available: false,
      authMode: "missing",
      baseUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler auth mode is missing."
    };
  }

  if (!isSupportedAuthMode(authModeValue)) {
    return {
      available: false,
      authMode: "unsupported",
      baseUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler auth mode is unsupported."
    };
  }

  if (!baseUrlConfigured || !apiKeyConfigured) {
    return {
      available: false,
      authMode: authModeValue,
      baseUrlConfigured,
      apiKeyConfigured,
      liveIntegrationImplemented: false,
      reason: "Datafordeler credentials are missing or incomplete."
    };
  }

  return {
    available: false,
    authMode: authModeValue,
    baseUrlConfigured,
    apiKeyConfigured,
    liveIntegrationImplemented: false,
    reason:
      "Datafordeler credentials are configured, but live integration is not implemented."
  };
}
