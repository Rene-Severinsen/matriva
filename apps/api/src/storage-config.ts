export type StorageMode = "local" | "s3";

type StorageEnvironment = Record<string, string | undefined>;

const sharedEnvironments = new Set(["qa", "production", "prod"]);

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function runtimeEnvironment(environment: StorageEnvironment = process.env) {
  const configured = normalized(environment.MATRIVA_ENVIRONMENT);
  if (configured) return configured;
  return normalized(environment.NODE_ENV) === "production" ? "production" : "local";
}

export function isSharedStorageEnvironment(environment: StorageEnvironment = process.env) {
  return sharedEnvironments.has(runtimeEnvironment(environment));
}

export function hasS3Configuration(environment: StorageEnvironment = process.env) {
  return Boolean(
    environment.MATRIVA_S3_ENDPOINT?.trim() &&
      environment.MATRIVA_S3_BUCKET?.trim() &&
      environment.MATRIVA_S3_ACCESS_KEY_ID?.trim() &&
      environment.MATRIVA_S3_SECRET_ACCESS_KEY?.trim()
  );
}

export function storageMode(environment: StorageEnvironment = process.env): StorageMode {
  const configuredAdapter = normalized(environment.MATRIVA_STORAGE_ADAPTER);

  if (isSharedStorageEnvironment(environment)) {
    return "s3";
  }

  if (configuredAdapter === "local") return "local";
  if (configuredAdapter === "s3") return "s3";
  return hasS3Configuration(environment) ? "s3" : "local";
}

export function validateStorageConfiguration(environment: StorageEnvironment = process.env) {
  const currentEnvironment = runtimeEnvironment(environment);
  const configuredAdapter = normalized(environment.MATRIVA_STORAGE_ADAPTER);

  if (isSharedStorageEnvironment(environment)) {
    if (configuredAdapter === "local") {
      throw new Error(
        `Local file storage is forbidden for MATRIVA_ENVIRONMENT=${currentEnvironment}; set MATRIVA_STORAGE_ADAPTER=s3.`
      );
    }

    if (!hasS3Configuration(environment)) {
      throw new Error(
        `S3 storage is required for MATRIVA_ENVIRONMENT=${currentEnvironment}, but the S3 configuration is incomplete.`
      );
    }

    return;
  }

  if (configuredAdapter === "s3" && !hasS3Configuration(environment)) {
    throw new Error("MATRIVA_STORAGE_ADAPTER=s3 requires a complete S3 configuration.");
  }
}
