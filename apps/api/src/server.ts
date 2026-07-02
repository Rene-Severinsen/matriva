import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";

import {
  addressSearchQuerySchema,
  addressSearchResponseSchema,
  apiErrorSchema,
  healthResponseSchema,
  homeBootstrapResponseSchema
} from "@matriva/shared";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "127.0.0.1";
const dawaAddressSearchUrl = "https://api.dataforsyningen.dk/adresser";
const dawaTimeoutMs = 2500;

type DawaAddress = {
  id?: unknown;
  adressebetegnelse?: unknown;
  etage?: unknown;
  dør?: unknown;
  adgangsadresse?: {
    id?: unknown;
    vejstykke?: {
      navn?: unknown;
      adresseringsnavn?: unknown;
    };
    husnr?: unknown;
    postnummer?: {
      nr?: unknown;
      navn?: unknown;
    };
  };
};

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createAddressSuggestionId(): `addr_${string}` {
  return `addr_${randomBytes(10).toString("hex")}`;
}

async function fetchDawaAddresses(query: string): Promise<DawaAddress[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dawaTimeoutMs);
  const url = new URL(dawaAddressSearchUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("per_side", "5");

  try {
    const dawaResponse = await fetch(url, { signal: controller.signal });

    if (!dawaResponse.ok) {
      throw new Error(`DAWA request failed with status ${dawaResponse.status}`);
    }

    const payload: unknown = await dawaResponse.json();

    if (!Array.isArray(payload)) {
      throw new Error("DAWA response was not an array");
    }

    return payload.filter(
      (item): item is DawaAddress =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  } finally {
    clearTimeout(timeout);
  }
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const body = healthResponseSchema.parse({
      status: "ok",
      service: "matriva-api",
      timestamp: new Date().toISOString()
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "GET" && request.url === "/v1/bootstrap") {
    const now = new Date().toISOString();
    const body = homeBootstrapResponseSchema.parse({
      user: {
        id: "usr_k7q4m2x9p8vn",
        displayName: "Development user",
        email: null
      },
      house: {
        id: "house_p9x2v7q4m8kn",
        displayName: "Skeleton house",
        address: {
          streetName: "Eksempelvej",
          houseNumber: "1",
          postalCode: "1000",
          city: "København",
          countryCode: "DK"
        },
        propertyType: "UNKNOWN"
      },
      entitlements: {
        plan: "free",
        status: "free",
        features: {
          "documents.maxCount": { kind: "limit", value: 0 },
          "documents.maxStorageMb": { kind: "limit", value: 0 },
          "tasks.maxActive": { kind: "limit", value: 0 },
          "advisories.enabled": { kind: "boolean", value: false },
          "legalUpdates.enabled": { kind: "boolean", value: false },
          "sharing.enabled": { kind: "boolean", value: false },
          "export.enabled": { kind: "boolean", value: false },
          "advancedReminders.enabled": { kind: "boolean", value: false }
        },
        evaluatedAt: now
      },
      cards: [
        {
          id: "card_m4v8q2x7k9pn",
          type: "SYSTEM_NOTICE",
          title: "Skeleton contract",
          shortExplanation:
            "Development-only bootstrap response for validating the shared API contract.",
          severity: "info",
          action: {
            label: "No action",
            target: { kind: "none" }
          },
          validFrom: now,
          validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          audience: {
            countryCode: "DK",
            propertyTypes: ["UNKNOWN"]
          },
          minAppVersion: "0.1.0",
          fallbackText:
            "Matriva is preparing the first backend-driven home card contract."
        }
      ],
      generatedAt: now,
      skeleton: true
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/v1/addresses/search")) {
    void (async () => {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const parsedQuery = addressSearchQuerySchema.safeParse({
        q: url.searchParams.get("q") ?? ""
      });

      if (!parsedQuery.success) {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "address_search_query_invalid",
            message: "Address search query must be at least 2 characters."
          })
        );
        return;
      }

      try {
        const dawaAddresses = await fetchDawaAddresses(parsedQuery.data.q);
        const suggestions = dawaAddresses.flatMap((address) => {
          const sourceAddressId = optionalString(address.id);

          if (!sourceAddressId) {
            return [];
          }

          return [
            {
              id: createAddressSuggestionId(),
              source: "DAWA",
              sourceAddressId,
              sourceAccessAddressId: optionalString(
                address.adgangsadresse?.id
              ),
              label:
                optionalString(address.adressebetegnelse) ?? sourceAddressId,
              roadName:
                optionalString(address.adgangsadresse?.vejstykke?.navn) ??
                optionalString(
                  address.adgangsadresse?.vejstykke?.adresseringsnavn
                ),
              houseNumber: optionalString(address.adgangsadresse?.husnr),
              floor: optionalString(address.etage),
              door: optionalString(address.dør),
              postalCode: optionalString(address.adgangsadresse?.postnummer?.nr),
              city: optionalString(address.adgangsadresse?.postnummer?.navn)
            }
          ];
        });

        const body = addressSearchResponseSchema.parse({
          query: parsedQuery.data.q,
          source: "DAWA",
          suggestions,
          generatedAt: new Date().toISOString()
        });

        writeJson(response, 200, body);
      } catch {
        writeJson(
          response,
          502,
          apiErrorSchema.parse({
            code: "address_search_source_unavailable",
            message: "Address search is temporarily unavailable."
          })
        );
      }
    })();
    return;
  }

  writeJson(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log(`Matriva API listening on http://${host}:${port}`);
});
