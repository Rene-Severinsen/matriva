const localApiBaseUrl = "http://127.0.0.1:4000";
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_MATRIVA_API_BASE_URL?.trim();

export const matrivaApiConfig = {
  baseUrl: configuredApiBaseUrl || localApiBaseUrl,
  usesLocalFallback: !configuredApiBaseUrl
} as const;
