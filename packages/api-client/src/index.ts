import {
  healthResponseSchema,
  homeBootstrapResponseSchema,
  type HealthResponse,
  type HomeBootstrapResponse
} from "@matriva/shared";

export type MatrivaApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export type MatrivaApiClient = {
  readonly baseUrl: string;
  health: () => Promise<HealthResponse>;
  getBootstrap: () => Promise<HomeBootstrapResponse>;
};

export function createMatrivaApiClient(
  options: MatrivaApiClientOptions
): MatrivaApiClient {
  const normalizedBaseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetchImpl ?? fetch;

  return {
    baseUrl: normalizedBaseUrl,
    async health() {
      const response = await fetcher(`${normalizedBaseUrl}/health`);

      if (!response.ok) {
        throw new Error(`Health request failed with status ${response.status}`);
      }

      return healthResponseSchema.parse(await response.json());
    },
    async getBootstrap() {
      const response = await fetcher(`${normalizedBaseUrl}/v1/bootstrap`);

      if (!response.ok) {
        throw new Error(
          `Bootstrap request failed with status ${response.status}`
        );
      }

      return homeBootstrapResponseSchema.parse(await response.json());
    }
  };
}
