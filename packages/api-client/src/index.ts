import {
  addressSearchResponseSchema,
  adminBootstrapResponseSchema,
  adminDashboardPeriodKeySchema,
  adminDashboardResponseSchema,
  adminHouseResponseSchema,
  adminHousesResponseSchema,
  adminRecommendationCatalogItemResponseSchema,
  adminRecommendationCatalogResponseSchema,
  adminUserResponseSchema,
  adminUsersResponseSchema,
  appBootstrapResponseSchema,
  authSessionResponseSchema,
  currentUserResponseSchema,
  houseImprovementResponseSchema,
  houseImprovementsResponseSchema,
  housePhotoResponseSchema,
  enrichHouseDraftResponseSchema,
  logoutResponseSchema,
  maintenanceHistoryResponseSchema,
  maintenanceHistoryDetailResponseSchema,
  maintenanceRecommendationsResponseSchema,
  maintenanceTaskResponseSchema,
  maintenanceTasksResponseSchema,
  houseDocumentResponseSchema,
  houseDocumentsResponseSchema,
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
  type AdminBootstrapResponse,
  type AdminDashboardPeriodKey,
  type AdminDashboardResponse,
  type AdminHousePublicDataStatusFilter,
  type AdminHouseResponse,
  type AdminHouseSort,
  type AdminHousesResponse,
  type AdminRecommendationActiveFilter,
  type AdminRecommendationCatalogItemResponse,
  type AdminRecommendationCatalogResponse,
  type AdminRecommendationCatalogSort,
  type AdminSortOrder,
  type AdminUserResponse,
  type AdminUserSort,
  type AdminUserStatusFilter,
  type AdminUsersResponse,
  type AppBootstrapResponse,
  type AuthSessionResponse,
  type ConsumeMagicLinkRequest,
  type CurrentUserResponse,
  type CreateHouseImprovementRequest,
  type CreateMaintenanceTaskRequest,
  type AcceptMaintenanceRecommendationRequest,
  type CompleteMaintenanceTaskRequest,
  type CreateSavedHouseRequest,
  type EnrichHouseDraftRequest,
  type EnrichHouseDraftResponse,
  type HealthResponse,
  type HouseDraftId,
  type HouseDraftOverviewPreviewResponse,
  type HouseDraftResponse,
  type HouseId,
  type HouseImprovementResponse,
  type HouseImprovementsResponse,
  type HousePhotoResponse,
  type HousePublicDataWithProfileResponseV1,
  type HomeBootstrapResponse,
  type LogoutResponse,
  type MaintenanceTaskResponse,
  type MaintenanceTasksResponse,
  type MaintenanceHistoryResponse,
  type MaintenanceHistoryDetailResponse,
  type MaintenanceHistoryQuery,
  type MaintenanceCompletionId,
  type MaintenanceRecommendationId,
  type DismissMaintenanceRecommendationRequest,
  type MaintenanceRecommendationsResponse,
  type MoveMaintenanceTaskRequest,
  type RefreshSessionRequest,
  type RequestMagicLinkRequest,
  type RequestMagicLinkResponse,
  type SavedHouseResponse,
  type SavedHousesResponse,
  type SelectedAddressInput,
  type TaskId,
  type DocumentId,
  type HouseDocumentResponse,
  type HouseDocumentsResponse,
  type UploadHouseDocumentRequest,
  type UploadHousePhotoRequest,
  type UpdateMaintenanceTaskRequest,
  type UpdateMaintenanceTaskStatusRequest,
  type UpdateProfileRequest,
  type UpdateProfileResponse
} from "@matriva/shared";

export type MatrivaApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => string | null | undefined;
};

export type AdminListRequest<Sort extends string> = {
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: Sort;
  order?: AdminSortOrder;
  signal?: AbortSignal;
};

export class MatrivaApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "MatrivaApiError";
    this.status = status;
    this.code = code;
  }
}

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
  getAdminBootstrap: () => Promise<AdminBootstrapResponse>;
  getAdminDashboard: (input?: {
    period?: AdminDashboardPeriodKey;
    signal?: AbortSignal;
  }) => Promise<AdminDashboardResponse>;
  getAdminUsers: (
    input?: AdminListRequest<AdminUserSort> & {
      status?: AdminUserStatusFilter;
    }
  ) => Promise<AdminUsersResponse>;
  getAdminUser: (
    userId: string,
    input?: { signal?: AbortSignal }
  ) => Promise<AdminUserResponse>;
  getAdminHouses: (
    input?: AdminListRequest<AdminHouseSort> & {
      publicDataStatus?: AdminHousePublicDataStatusFilter;
    }
  ) => Promise<AdminHousesResponse>;
  getAdminHouse: (
    houseId: string,
    input?: { signal?: AbortSignal }
  ) => Promise<AdminHouseResponse>;
  getAdminRecommendationCatalog: (
    input?: AdminListRequest<AdminRecommendationCatalogSort> & {
      active?: AdminRecommendationActiveFilter;
      category?: string;
    }
  ) => Promise<AdminRecommendationCatalogResponse>;
  getAdminRecommendationCatalogItem: (
    catalogKey: string,
    input?: { signal?: AbortSignal }
  ) => Promise<AdminRecommendationCatalogItemResponse>;
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
  getMaintenanceTask: (
    houseId: HouseId,
    taskId: TaskId
  ) => Promise<MaintenanceTaskResponse>;
  updateMaintenanceTask: (
    houseId: HouseId,
    taskId: TaskId,
    input: UpdateMaintenanceTaskRequest
  ) => Promise<MaintenanceTaskResponse>;
  moveMaintenanceTask: (
    houseId: HouseId,
    taskId: TaskId,
    input: MoveMaintenanceTaskRequest
  ) => Promise<MaintenanceTaskResponse>;
  completeMaintenanceTask: (
    houseId: HouseId,
    taskId: TaskId,
    input: CompleteMaintenanceTaskRequest
  ) => Promise<MaintenanceTaskResponse>;
  deleteMaintenanceTask: (
    houseId: HouseId,
    taskId: TaskId
  ) => Promise<MaintenanceTaskResponse>;
  updateMaintenanceTaskStatus: (
    houseId: HouseId,
    taskId: TaskId,
    input: UpdateMaintenanceTaskStatusRequest
  ) => Promise<MaintenanceTaskResponse>;
  listMaintenanceHistory: (
    houseId: HouseId,
    query?: MaintenanceHistoryQuery
  ) => Promise<MaintenanceHistoryResponse>;
  getMaintenanceHistoryEntry: (
    houseId: HouseId,
    completionId: MaintenanceCompletionId
  ) => Promise<MaintenanceHistoryDetailResponse>;
  listHouseDocuments: (
    houseId: HouseId
  ) => Promise<HouseDocumentsResponse>;
  uploadHouseDocument: (
    houseId: HouseId,
    input: UploadHouseDocumentRequest
  ) => Promise<HouseDocumentResponse>;
  deleteHouseDocument: (
    houseId: HouseId,
    documentId: DocumentId
  ) => Promise<HouseDocumentResponse>;
  listMaintenanceRecommendations: (
    houseId: HouseId
  ) => Promise<MaintenanceRecommendationsResponse>;
  acceptMaintenanceRecommendation: (
    houseId: HouseId,
    recommendationId: MaintenanceRecommendationId,
    input: AcceptMaintenanceRecommendationRequest
  ) => Promise<MaintenanceTaskResponse>;
  dismissMaintenanceRecommendation: (
    houseId: HouseId,
    recommendationId: MaintenanceRecommendationId,
    input?: DismissMaintenanceRecommendationRequest
  ) => Promise<unknown>;
  listHouseImprovements: (
    houseId: HouseId
  ) => Promise<HouseImprovementsResponse>;
  createHouseImprovement: (
    houseId: HouseId,
    input: CreateHouseImprovementRequest
  ) => Promise<HouseImprovementResponse>;
  getHousePhoto: (houseId: HouseId) => Promise<HousePhotoResponse>;
  setHousePhoto: (
    houseId: HouseId,
    input: UploadHousePhotoRequest
  ) => Promise<HousePhotoResponse>;
  removeHousePhoto: (houseId: HouseId) => Promise<HousePhotoResponse>;
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
    let code: string | null = null;

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

      if (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        typeof payload.code === "string"
      ) {
        code = payload.code;
      }
    } catch {
      // Keep the route-specific fallback when the API response is not JSON.
    }

    throw new MatrivaApiError(response.status, code, message);
  }

  async function getHealth() {
    const response = await fetcher(`${normalizedBaseUrl}/health`);

    if (!response.ok) {
      throw new Error(`Health request failed with status ${response.status}`);
    }

    return healthResponseSchema.parse(await response.json());
  }

  function adminListSearchParams(input: Record<string, unknown> = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(input)) {
      if (
        key === "signal" ||
        value === undefined ||
        value === null ||
        value === ""
      ) {
        continue;
      }

      params.set(key, String(value));
    }

    const query = params.toString();
    return query ? `?${query}` : "";
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
    async getAdminBootstrap() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/admin/bootstrap`, {
        headers: authHeaders()
      });

      return adminBootstrapResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin session.")
      );
    },
    async getAdminDashboard(input = {}) {
      const period = adminDashboardPeriodKeySchema.parse(input.period ?? "30d");
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/dashboard?period=${period}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminDashboardResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin dashboard.")
      );
    },
    async getAdminUsers(input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/users${adminListSearchParams(input)}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminUsersResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin users.")
      );
    },
    async getAdminUser(userId, input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminUserResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin user.")
      );
    },
    async getAdminHouses(input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/houses${adminListSearchParams(input)}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminHousesResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin houses.")
      );
    },
    async getAdminHouse(houseId, input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/houses/${encodeURIComponent(houseId)}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminHouseResponseSchema.parse(
        await parseApiResponse(response, "Could not load admin house.")
      );
    },
    async getAdminRecommendationCatalog(input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/recommendations/catalog${adminListSearchParams(
          input
        )}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminRecommendationCatalogResponseSchema.parse(
        await parseApiResponse(
          response,
          "Could not load admin recommendation catalog."
        )
      );
    },
    async getAdminRecommendationCatalogItem(catalogKey, input = {}) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/admin/recommendations/catalog/${encodeURIComponent(
          catalogKey
        )}`,
        {
          headers: authHeaders(),
          ...(input.signal ? { signal: input.signal } : {})
        }
      );

      return adminRecommendationCatalogItemResponseSchema.parse(
        await parseApiResponse(
          response,
          "Could not load admin recommendation catalog item."
        )
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
    async getMaintenanceTask(houseId, taskId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}`,
        { headers: authHeaders() }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not load maintenance task.")
      );
    },
    async updateMaintenanceTask(houseId, taskId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}`,
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
    },
    async moveMaintenanceTask(houseId, taskId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}/move`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not move maintenance task.")
      );
    },
    async completeMaintenanceTask(houseId, taskId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}/complete`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not complete maintenance task.")
      );
    },
    async deleteMaintenanceTask(houseId, taskId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-tasks/${taskId}`,
        {
          method: "DELETE",
          headers: authHeaders()
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not delete maintenance task.")
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
    },
    async listMaintenanceHistory(houseId, query) {
      const searchParams = new URLSearchParams();

      if (query?.year) {
        searchParams.set("year", `${query.year}`);
      }

      if (query?.componentKey) {
        searchParams.set("componentKey", query.componentKey);
      }

      const queryString = searchParams.toString();
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-history${queryString ? `?${queryString}` : ""}`,
        { headers: authHeaders() }
      );

      return maintenanceHistoryResponseSchema.parse(
        await parseApiResponse(response, "Could not load maintenance history.")
      );
    },
    async getMaintenanceHistoryEntry(houseId, completionId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-history/${completionId}`,
        { headers: authHeaders() }
      );

      return maintenanceHistoryDetailResponseSchema.parse(
        await parseApiResponse(response, "Could not load maintenance history detail.")
      );
    },
    async listHouseDocuments(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/documents`,
        { headers: authHeaders() }
      );

      return houseDocumentsResponseSchema.parse(
        await parseApiResponse(response, "Could not load house documents.")
      );
    },
    async uploadHouseDocument(houseId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/documents`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return houseDocumentResponseSchema.parse(
        await parseApiResponse(response, "Could not upload house document.")
      );
    },
    async deleteHouseDocument(houseId, documentId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: authHeaders()
        }
      );

      return houseDocumentResponseSchema.parse(
        await parseApiResponse(response, "Could not delete house document.")
      );
    },
    async listMaintenanceRecommendations(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-recommendations`,
        { headers: authHeaders() }
      );

      return maintenanceRecommendationsResponseSchema.parse(
        await parseApiResponse(response, "Could not load maintenance recommendations.")
      );
    },
    async acceptMaintenanceRecommendation(houseId, recommendationId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-recommendations/${recommendationId}/accept`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return maintenanceTaskResponseSchema.parse(
        await parseApiResponse(response, "Could not accept maintenance recommendation.")
      );
    },
    async dismissMaintenanceRecommendation(houseId, recommendationId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/maintenance-recommendations/${recommendationId}/dismiss`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input ?? {})
        }
      );

      return parseApiResponse(response, "Could not dismiss maintenance recommendation.");
    },
    async listHouseImprovements(houseId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/improvements`,
        { headers: authHeaders() }
      );

      return houseImprovementsResponseSchema.parse(
        await parseApiResponse(response, "Could not load house improvements.")
      );
    },
    async createHouseImprovement(houseId, input) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/houses/${houseId}/improvements`,
        {
          method: "POST",
          headers: authHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify(input)
        }
      );

      return houseImprovementResponseSchema.parse(
        await parseApiResponse(response, "Could not create house improvement.")
      );
    },
    async getHousePhoto(houseId) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses/${houseId}/photo`, {
        headers: authHeaders()
      });

      return housePhotoResponseSchema.parse(
        await parseApiResponse(response, "Could not load house photo.")
      );
    },
    async setHousePhoto(houseId, input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses/${houseId}/photo`, {
        method: "PUT",
        headers: authHeaders({
          "content-type": "application/json"
        }),
        body: JSON.stringify(input)
      });

      return housePhotoResponseSchema.parse(
        await parseApiResponse(response, "Could not upload house photo.")
      );
    },
    async removeHousePhoto(houseId) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/houses/${houseId}/photo`, {
        method: "DELETE",
        headers: authHeaders()
      });

      return housePhotoResponseSchema.parse(
        await parseApiResponse(response, "Could not remove house photo.")
      );
    }
  };
}
