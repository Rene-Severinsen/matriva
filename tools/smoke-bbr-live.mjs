import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getDatafordelerRuntimeConfig } from "../apps/api/dist/config/datafordeler.js";
import { DatafordelerClient } from "../apps/api/dist/public-data/datafordeler-client.js";
import { mapPublicData } from "../apps/api/dist/public-data/mapper.js";

function loadLocalEnv() {
  const envPath = resolve(".env");

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

if (!process.env.DATAFORDELER_API_KEY) {
  throw new Error(
    "smoke:bbr:live requires DATAFORDELER_API_KEY in the local environment."
  );
}

const target = {
  kind: "house",
  id: "house_livebbrsmoke",
  userId: "usr_livebbrsmoke",
  addressLabel: "Ringstedgade 130, 4700 Næstved",
  darAddressId: "0a3f50b0-b49d-32b8-e044-0003ba298018",
  darAccessAddressId: "0a3f5086-3246-32b8-e044-0003ba298018"
};

function sanitizedEndpointConfig() {
  const runtime = getDatafordelerRuntimeConfig();

  return {
    graphqlUrl: runtime.graphqlUrl,
    timeoutMs: runtime.timeoutMs,
    apiKeyConfigured: Boolean(process.env.DATAFORDELER_API_KEY)
  };
}

let raw;

try {
  raw = await new DatafordelerClient().enrichAddress(target.darAddressId);
} catch (error) {
  console.error(
    JSON.stringify({
      event: "smoke.bbr.live_failed",
      endpoint: sanitizedEndpointConfig(),
      providerError: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : "Unknown provider error",
        code:
          typeof error === "object" && error !== null && "code" in error
            ? error.code
            : "unknown"
      }
    })
  );
  process.exitCode = 1;
  throw error;
}

const mapped = mapPublicData(target, raw);
const addressBuilding = mapped.buildings.find(
  (building) => building.bbrBuildingId === mapped.selection.primaryBuildingId
);
const primaryUnit = addressBuilding?.units.find(
  (unit) => unit.bbrUnitId === mapped.selection.primaryUnitId
);

assert.equal(mapped.contract, "house_public_data.v1");
assert.equal(mapped.address?.darAddressId, target.darAddressId);
assert.equal(mapped.selection.primaryBuildingStatus, "automatic_address_relation");
assert.equal(mapped.property?.bfeNumber, "2522814");
assert.ok(addressBuilding, "Live BBR smoke requires an address building.");
assert.equal(addressBuilding?.use?.code, "120");
assert.equal(primaryUnit?.areas.residentialAreaM2, 122);
assert.equal(addressBuilding?.heating.installation?.code, "2");
assert.equal(addressBuilding?.heating.source?.code, "7");
assert.equal(addressBuilding?.heating.supplementary?.code, "90");

console.log(
  JSON.stringify({
    event: "smoke.bbr.live_passed",
    address: target.addressLabel,
    darAddressId: mapped.address?.darAddressId,
    addressBuildingId: mapped.selection.primaryBuildingId,
    bfeNumber: mapped.property?.bfeNumber,
    buildingUse: addressBuilding?.use?.code,
    residentialAreaM2: primaryUnit?.areas.residentialAreaM2,
    heatingInstallation: addressBuilding?.heating.installation?.code,
    heatingSource: addressBuilding?.heating.source?.code,
    supplementaryHeating: addressBuilding?.heating.supplementary?.code,
    endpoint: sanitizedEndpointConfig()
  })
);
