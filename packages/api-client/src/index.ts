import {
  addressSearchResponseSchema,
  appBootstrapResponseSchema,
  authSessionResponseSchema,
  currentUserResponseSchema,
  enrichHouseDraftResponseSchema,
  logoutResponseSchema,
  maintenanceTaskResponseSchema,
  maintenanceTasksResponseSchema,
  refreshSessionRequestSchema,
  requestMagicLinkResponseSchema,
  updateProfileResponseSchema,
  savedHouseResponseSchema,
  savedHousesResponseSchema,
  healthResponseSchema,
  houseDraftOverviewPreviewResponseSchema,
  houseDraftResponseSchema,
  homeBootstrapResponseSchema,
  housePublicDataWithProfileResponseV1Schema,
  type AddressSearchResponse,
  type AppBootstrapResponse,
  type AuthSessionResponse,
  type ConsumeMagicLinkRequest,
  type CurrentUserResponse,
  type CreateMaintenanceTaskRequest,
  type CreateSavedHouseRequest,
  type EnrichHouseDraftRequest,
  type EnrichHouseDraftResponse,
  type HealthResponse,
  type HouseDraftId,
  type HouseDraftOverviewPreviewResponse,
  type HouseDraftResponse,
  type HouseId,
  type HousePublicDataWithProfileResponseV1,
  type HomeBootstrapResponse,
  type LogoutResponse,
  type MaintenanceTaskResponse,
  type MaintenanceTasksResponse,
  type RefreshSessionRequest,
  type RequestMagicLinkRequest,
  type RequestMagicLinkResponse,
  type SavedHouseResponse,
  type SavedHousesResponse,
  type SelectedAddressInput,
  type TaskId,
  type UpdateMaintenanceTaskStatusRequest,
  type UpdateProfileRequest,
  type UpdateProfileResponse
} from "@matriva/shared";

export type MatrivaApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | null | undefined;
};

export type MatrivaApiClient = {
  readonly baseUrl: string;
  getHealth: () => Promise<HealthResponse>;
  health: () => Promise<HealthResponse>;
  getBootstrap: () => Promise<HomeBootstrapResponse>;
  requestMagicLink: (input: RequestMagicLinkRequest) => Promise<RequestMagicLinkResponse>;
  consumeMagicLink: (input: ConsumeMagicLinkRequest) => Promise<AuthSessionResponse>;
  refreshSession: (input: RefreshSessionRequest) => Promise<AuthSessionResponse>;
  logout: (input: RefreshSessionRequest) => Promise<LogoutResponse>;
  getCurrentUser: () => Promise<CurrentUserResponse>;
  updateProfile: (input: UpdateProfileRequest) => Promise<UpdateProfileResponse>;
  getAppBootstrap: () => Promise<AppBootstrapResponse>;
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
  getHousePublicData: (
    houseId: HouseId
  ) => Promise<HousePublicDataWithProfileResponseV1>;
  refreshHousePublicData: (
    houseId: HouseId
  ) => Promise<HousePublicDataWithProfileResponseV1>;
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

  function authHeaders(extra?: HeadersInit): HeadersInit {
    const token = options.getAccessToken?.();

    return {
      ...(extra ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    };
  }

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
    async requestMagicLink(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/auth/magic-link/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });

      return requestMagicLinkResponseSchema.parse(
        await parseApiResponse(response, "Could not request login link.")
      );
    },
    async consumeMagicLink(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/auth/magic-link/consume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });

      return authSessionResponseSchema.parse(
        await parseApiResponse(response, "Could not log in with this link.")
      );
    },
    async refreshSession(input) {
      refreshSessionRequestSchema.parse(input);
      const response = await fetcher(`${normalizedBaseUrl}/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });

      return authSessionResponseSchema.parse(
        await parseApiResponse(response, "Could not refresh session.")
      );
    },
    async logout(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/auth/logout`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input)
      });

      return logoutResponseSchema.parse(
        await parseApiResponse(response, "Could not log out.")
      );
    },
    async getCurrentUser() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/me`, {
        headers: authHeaders()
      });

      return currentUserResponseSchema.parse(
        await parseApiResponse(response, "Could not load profile.")
      );
    },
    async updateProfile(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/me/profile`, {
        method: "PUT",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(input)
      });

      return updateProfileResponseSchema.parse(
        await parseApiResponse(response, "Could not save profile.")
      );
    },
    async getAppBootstrap() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/app-bootstrap`, {
        headers: authHeaders()
      });

      return appBootstrapResponseSchema.parse(
        await parseApiResponse(response, "Could not load app state.")
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
        headers: authHeaders({
          "content-type": "application/json"
        }),
        body: JSON.stringify(input)
      });

      return houseDraftResponseSchema.parse(
        await parseApiResponse(response, "Could not create house draft.")
      );
    },
    async getHouseDraftOverviewPreview(houseDraftId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/house-drafts/${houseDraftId}/overview-preview`,
        { headers: authHeaders() }
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
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return enrichHouseDraftResponseSchema.parse(
        await parseApiResponse(response, "Could not load house data.")
      );
    },
    async listHouses() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses`, {
        headers: authHeaders()
      });

      return savedHousesResponseSchema.parse(
        await parseApiResponse(response, "Could not load saved houses.")
      );
    },
    async createSavedHouse(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses`, {
        method: "POST",
        headers: authHeaders({
          "content-type": "application/json"
        }),
        body: JSON.stringify(input)
      });

      return savedHouseResponseSchema.parse(
        await parseApiResponse(response, "Could not save house.")
      );
    },
    async getHouse(houseId) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses/${houseId}`, {
        headers: authHeaders()
      });

      return savedHouseResponseSchema.parse(
        await parseApiResponse(response, "Could not load house.")
      );
    },
    async getHousePublicData(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/public-data`,
        { headers: authHeaders() }
      );

      return housePublicDataWithProfileResponseV1Schema.parse(
        await parseApiResponse(response, "Could not load public house data.")
      );
    },
    async refreshHousePublicData(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/public-data/refresh`,
        {
          method: "POST",
          headers: authHeaders()
        }
      );

      return housePublicDataWithProfileResponseV1Schema.parse(
        await parseApiResponse(response, "Could not refresh public house data.")
      );
    },
    async listMaintenanceTasks(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks`,
        { headers: authHeaders() }
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
          headers: authHeaders({
            "content-type": "application/json"
          }),
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
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not update maintenance task.")
      );
    }
  };
}
