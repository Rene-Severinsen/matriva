import assert from "node:assert/strict";

const { hasS3Configuration, storageMode, validateStorageConfiguration } =
  await import("../apps/api/dist/storage-config.js");

const s3 = {
  MATRIVA_ENVIRONMENT: "qa",
  MATRIVA_STORAGE_ADAPTER: "s3",
  MATRIVA_S3_ENDPOINT: "https://hel1.example.test",
  MATRIVA_S3_BUCKET: "matriva-qa",
  MATRIVA_S3_ACCESS_KEY_ID: "access",
  MATRIVA_S3_SECRET_ACCESS_KEY: "secret"
};

assert.equal(hasS3Configuration(s3), true);
assert.equal(storageMode(s3), "s3");
assert.doesNotThrow(() => validateStorageConfiguration(s3));

assert.throws(
  () => validateStorageConfiguration({ ...s3, MATRIVA_STORAGE_ADAPTER: "local" }),
  /Local file storage is forbidden/
);
assert.throws(
  () => validateStorageConfiguration({ ...s3, MATRIVA_S3_SECRET_ACCESS_KEY: "" }),
  /S3 storage is required/
);

const local = { MATRIVA_ENVIRONMENT: "local", MATRIVA_STORAGE_ADAPTER: "local" };
assert.equal(storageMode(local), "local");
assert.doesNotThrow(() => validateStorageConfiguration(local));

console.log("Storage policy validated: local/dev/test may use local storage; QA/production require S3.");
