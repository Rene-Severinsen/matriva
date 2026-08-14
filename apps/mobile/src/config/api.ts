import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  nonProductionEnvironmentLabel,
  normalizeAppIdentityValue
} from "./appIdentity";

const localApiBaseUrl = "http://127.0.0.1:4000";
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_MATRIVA_API_BASE_URL?.trim();

const expoConfig = Constants.expoConfig;
const platformConfig = Platform.OS === "ios" ? expoConfig?.ios : expoConfig?.android;
const configuredBuild = (() => {
  if (!platformConfig || typeof platformConfig !== "object") {
    return null;
  }

  if ("buildNumber" in platformConfig) {
    return platformConfig.buildNumber;
  }

  if ("versionCode" in platformConfig) {
    return platformConfig.versionCode;
  }

  return null;
})();

export const matrivaApiConfig = {
  baseUrl: configuredApiBaseUrl || localApiBaseUrl,
  usesLocalFallback: !configuredApiBaseUrl,
  guidePreviewEnabled: process.env.EXPO_PUBLIC_MATRIVA_GUIDE_PREVIEW === "true",
  appVersion: normalizeAppIdentityValue(expoConfig?.version),
  appBuild: normalizeAppIdentityValue(configuredBuild),
  environmentLabel: nonProductionEnvironmentLabel(
    process.env.EXPO_PUBLIC_MATRIVA_ENVIRONMENT
  )
} as const;
