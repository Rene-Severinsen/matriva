import {
  addressSearchResponseSchema,
  enrichHouseDraftResponseSchema,
  maintenanceTaskResponseSchema,
  maintenanceTasksResponseSchema,
  savedHouseResponseSchema,
  savedHousesResponseSchema,
  healthResponseSchema,
  houseDraftOverviewPreviewResponseSchema,
  houseDraftResponseSchema,
  homeBootstrapResponseSchema,
  type AddressSearchResponse,
  type CreateMaintenanceTaskRequest,
  type CreateSavedHouseRequest,
  type EnrichHouseDraftRequest,
  type EnrichHouseDraftResponse,
  type HealthResponse,
  type HouseDraftId,
  type HouseDraftOverviewPreviewResponse,
  type HouseDraftResponse,
  type HouseId,
  type HomeBootstrapResponse,
  type MaintenanceTaskResponse,
  type MaintenanceTasksResponse,
  type SavedHouseResponse,
  type SavedHousesResponse,
  type SelectedAddressInput,
  type TaskId,
  type UpdateMaintenanceTaskStatusRequest
} from "@matriva/shared";

export type MatrivaApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type MatrivaApiClient = {
  readonly baseUrl: string;
  getHealth: () => Promise<HealthResponse>;
  health: () => Promise<HealthResponse>;
  getBootstrap: () => Promise<HomeBootstrapResponse>;
  searchAddresses: (query: string) => Promise<AddressSearchResponse>;
  createHouseDraft: (input: SelectedAddressInput) => Promise<HouseDraftResponse>;
  getHouseDraftOverviewPreview: (
    houseDraftId: HouseDraftId
  ) => Promise<HouseDraftOverviewPreviewResponse>;
  enrichHouseDraft: (
    input: EnrichHouseDraftRequest
  ) => Promise<EnrichHouseDraftResponse>;
  listHouses: () => Promise<SavedHousesResponse>;
  createSavedHouse: (
    input: CreateSavedHouseRequest
  ) => Promise<SavedHouseResponse>;
  getHouse: (houseId: HouseId) => Promise<SavedHouseResponse>;
  listMaintenanceTasks: (
    houseId: HouseId
  ) => Promise<MaintenanceTasksResponse>;
  createMaintenanceTask: (
    houseId: HouseId,
    input: CreateMaintenanceTaskRequest
  ) => Promise<MaintenanceTaskResponse>;
  updateMaintenanceTaskStatus: (
    houseId: HouseId,
    taskId: TaskId,
    input: UpdateMaintenanceTaskStatusRequest
  ) => Promise<MaintenanceTaskResponse>;
};

export function createMatrivaApiClient(
  options: MatrivaApiClientOptions
): MatrivaApiClient {
  const normalizedBaseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetchImpl ?? fetch;

  async function parseApiResponse(response: Response, fallbackMessage: string) {
    if (response.ok) {
      return response.json();
    }

    let message = fallbackMessage;

    try {
      const payload = await response.json();

      if (
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string"
      ) {
        message = payload.message;
      }
    } catch {
      // Keep the route-specific fallback when the API response is not JSON.
    }

    throw new Error(message);
  }

  async function getHealth() {
    const response = await fetcher(`${normalizedBaseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health request failed with status ${response.status}`);
    }

    return healthResponseSchema.parse(await response.json());
  }

  return {
    baseUrl: normalizedBaseUrl,
    getHealth,
    async health() {
      return getHealth();
    },
    async getBootstrap() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/bootstrap`);

      return homeBootstrapResponseSchema.parse(
        await parseApiResponse(response, "Could not load home data.")
      );
    },
    async searchAddresses(query) {
      const searchParams = new URLSearchParams({ q: query });
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/addresses/search?${searchParams.toString()}`
      );

      return addressSearchResponseSchema.parse(
        await parseApiResponse(response, "Could not search addresses.")
      );
    },
    async createHouseDraft(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/house-drafts`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });

      return houseDraftResponseSchema.parse(
        await parseApiResponse(response, "Could not create house draft.")
      );
    },
    async getHouseDraftOverviewPreview(houseDraftId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/house-drafts/${houseDraftId}/overview-preview`
      );

      return houseDraftOverviewPreviewResponseSchema.parse(
        await parseApiResponse(response, "Could not load house overview.")
      );
    },
    async enrichHouseDraft(input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/house-drafts/enrich`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(input)
        }
      );

      return enrichHouseDraftResponseSchema.parse(
        await parseApiResponse(response, "Could not load house data.")
      );
    },
    async listHouses() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses`);

      return savedHousesResponseSchema.parse(
        await parseApiResponse(response, "Could not load saved houses.")
      );
    },
    async createSavedHouse(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });

      return savedHouseResponseSchema.parse(
        await parseApiResponse(response, "Could not save house.")
      );
    },
    async getHouse(houseId) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses/${houseId}`);

      return savedHouseResponseSchema.parse(
        await parseApiResponse(response, "Could not load house.")
      );
    },
    async listMaintenanceTasks(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks`
      );

      return maintenanceTasksResponseSchema.parse(
        await parseApiResponse(response, "Could not load maintenance tasks.")
      );
    },
    async createMaintenanceTask(houseId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not create maintenance task.")
      );
    },
    async updateMaintenanceTaskStatus(houseId, taskId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not update maintenance task.")
      );
    }
  };
}
