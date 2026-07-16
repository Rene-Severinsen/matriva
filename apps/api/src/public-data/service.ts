import {
  buildHousePublicDataSummary,
  type HouseId,
  type HousePublicDataResponseV1,
  type SavedHouse
} from "@matriva/shared";

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

const inProcessRefreshes = new Map<string, Promise<HousePublicDataResponseV1>>();

function publicDataCanBeShownAfterRefreshFailure(
  publicData: HousePublicDataResponseV1
) {
  return (
    publicData.status === "success" ||
    publicData.status === "partial" ||
    publicData.status === "ambiguous"
  );
}

async function previousUsableHousePublicData(userId: string, houseId: string) {
  const current = await getCurrentHousePublicData(userId, houseId);

  return publicDataCanBeShownAfterRefreshFailure(current) ? current : null;
}

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

export async function getHousePublicDataSummary(userId: string, houseId: HouseId) {
  const publicData = await getHousePublicData(userId, houseId);

  return buildHousePublicDataSummary(houseId, publicData);
}

export async function getHousePublicDataSummaries(
  userId: string,
  houses: SavedHouse[]
) {
  return Promise.all(
    houses.map((house) => getHousePublicDataSummary(userId, house.id))
  );
}

export function startHousePublicDataRefreshAfterHouseCreated(
  userId: string,
  houseId: HouseId
) {
  // Temporary v1 limitation: there is no durable queue yet, so saved-house
  // enrichment is triggered in-process and isolated from the create response.
  void refreshHousePublicData(userId, houseId)
    .then((publicData) => {
      console.info(
        JSON.stringify({
          event: "public_data.saved_house_refresh_finished",
          houseId,
          status: publicData.status
        })
      );
    })
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          event: "public_data.saved_house_refresh_failed",
          houseId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        })
      );
    });
}

export async function refreshHousePublicData(
  userId: string,
  houseId: string,
  client = new DatafordelerClient()
) {
  const refreshKey = `${userId}:${houseId}`;
  const existingRefresh = inProcessRefreshes.get(refreshKey);

  if (existingRefresh) {
    return existingRefresh;
  }

  const refresh = performHousePublicDataRefresh(userId, houseId, client).finally(
    () => {
      inProcessRefreshes.delete(refreshKey);
    }
  );

  inProcessRefreshes.set(refreshKey, refresh);

  return refresh;
}

async function performHousePublicDataRefresh(
  userId: string,
  houseId: string,
  client: DatafordelerClient
) {
  const target = await getPublicDataTargetForHouse(userId, houseId);
  const configStatus = getDatafordelerConfigStatus();

  if (!configStatus.available) {
    await recordHousePublicDataFailure(
      target,
      "temporarily_unavailable",
      "provider_not_configured",
      "Public data enrichment is not configured on the server."
    );

    return (
      (await previousUsableHousePublicData(userId, houseId)) ??
      unavailableResponse()
    );
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

      if (status !== "not_found") {
        const previous = await previousUsableHousePublicData(userId, houseId);

        if (previous) {
          return previous;
        }
      }

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
    const previous = await previousUsableHousePublicData(userId, houseId);

    if (previous) {
      return previous;
    }

    throw error;
  }
}
