import {
  addressSearchResponseSchema,
  enrichHouseDraftResponseSchema,
  healthResponseSchema,
  houseDraftOverviewPreviewResponseSchema,
  houseDraftResponseSchema,
  homeBootstrapResponseSchema,
  type AddressSearchResponse,
  type EnrichHouseDraftRequest,
  type EnrichHouseDraftResponse,
  type HealthResponse,
  type HouseDraftId,
  type HouseDraftOverviewPreviewResponse,
  type HouseDraftResponse,
  type HomeBootstrapResponse,
  type SelectedAddressInput
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
};

export function createMatrivaApiClient(
  options: MatrivaApiClientOptions
): MatrivaApiClient {
  const normalizedBaseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetchImpl ?? fetch;

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

      if (!response.ok) {
        throw new Error(
          `Bootstrap request failed with status ${response.status}`
        );
      }

      return homeBootstrapResponseSchema.parse(await response.json());
    },
    async searchAddresses(query) {
      const searchParams = new URLSearchParams({ q: query });
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/addresses/search?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          `Address search request failed with status ${response.status}`
        );
      }

      return addressSearchResponseSchema.parse(await response.json());
    },
    async createHouseDraft(input) {
      const response = await fetcher(`${normalizedBaseUrl}/v1/house-drafts`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(
          `House draft request failed with status ${response.status}`
        );
      }

      return houseDraftResponseSchema.parse(await response.json());
    },
    async getHouseDraftOverviewPreview(houseDraftId) {
      const response = await fetcher(
        `${normalizedBaseUrl}/v1/house-drafts/${houseDraftId}/overview-preview`
      );

      if (!response.ok) {
        throw new Error(
          `House draft overview preview request failed with status ${response.status}`
        );
      }

      return houseDraftOverviewPreviewResponseSchema.parse(
        await response.json()
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

      if (!response.ok) {
        throw new Error(
          `House draft enrichment request failed with status ${response.status}`
        );
      }

      return enrichHouseDraftResponseSchema.parse(await response.json());
    }
  };
}
