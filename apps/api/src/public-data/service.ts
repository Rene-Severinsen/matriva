import type { HousePublicDataResponseV1 } from "@matriva/shared";

import { getDatafordelerConfigStatus } from "../config/datafordeler.ts";
import {
  DatafordelerClient,
  DatafordelerProviderError
} from "./datafordeler-client.ts";
import { mapPublicData } from "./mapper.ts";
import {
  getCurrentHousePublicData,
  getPublicDataTargetForHouse,
  recordHousePublicDataFailure,
  saveHousePublicDataSnapshot
} from "./repository.ts";

function unavailableResponse(): HousePublicDataResponseV1 {
  return {
    contract: "house_public_data.v1",
    status: "temporarily_unavailable",
    source: {
      provider: "datafordeler",
      register: "bbr",
      fetchedAt: new Date().toISOString(),
      effectiveAt: null,
      mappingVersion: "house_public_data_mapping.v1",
      codebookVersion: "2026-07-16.v1"
    },
    selection: {
      primaryBuildingId: null,
      primaryBuildingStatus: "not_found",
      primaryUnitId: null,
      primaryUnitStatus: "not_found"
    },
    address: null,
    property: null,
    ground: null,
    parcels: [],
    buildings: [],
    productBuildings: [],
    warnings: [
      {
        code: "provider_not_configured",
        message: "Public data enrichment is not configured on the server."
      }
    ]
  };
}

export async function getHousePublicData(userId: string, houseId: string) {
  return getCurrentHousePublicData(userId, houseId);
}

export async function refreshHousePublicData(
  userId: string,
  houseId: string,
  client = new DatafordelerClient()
) {
  const target = await getPublicDataTargetForHouse(userId, houseId);
  const configStatus = getDatafordelerConfigStatus();

  if (!configStatus.available) {
    return unavailableResponse();
  }

  try {
    const raw = await client.enrichAddress(target.darAddressId);
    const normalized = mapPublicData(target, raw);
    return saveHousePublicDataSnapshot(target, raw, normalized);
  } catch (error) {
    if (error instanceof DatafordelerProviderError) {
      const status =
        error.code === "provider_not_found"
          ? "not_found"
          : error.retryable
            ? "temporarily_unavailable"
            : "failed";
      await recordHousePublicDataFailure(
        target,
        status,
        error.code,
        error.message
      );
      return {
        ...unavailableResponse(),
        status,
        warnings: [
          {
            code:
              status === "not_found"
                ? "provider_not_found"
                : "provider_temporarily_unavailable",
            message: error.message
          }
        ]
      } satisfies HousePublicDataResponseV1;
    }

    await recordHousePublicDataFailure(
      target,
      "failed",
      "public_data_mapping_failed",
      "Public data enrichment failed."
    );
    throw error;
  }
}
