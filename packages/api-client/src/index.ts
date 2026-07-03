import {
  addressSearchResponseSchema,
  healthResponseSchema,
  houseDraftResponseSchema,
  homeBootstrapResponseSchema,
  type AddressSearchResponse,
  type HealthResponse,
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
    }
  };
}
