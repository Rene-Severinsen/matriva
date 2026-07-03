import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  addressSearchQuerySchema,
  addressSearchResponseSchema,
  apiErrorSchema,
  enrichHouseDraftRequestSchema,
  enrichHouseDraftResponseSchema,
  healthResponseSchema,
  houseDraftIdSchema,
  houseDraftOverviewPreviewResponseSchema,
  houseDraftResponseSchema,
  homeBootstrapResponseSchema,
  selectedAddressInputSchema
} from "@matriva/shared";

import { getDatafordelerConfigStatus } from "./config/datafordeler.ts";

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

function devUrlsForHost(bindHost: string, bindPort: number) {
  const localUrl = `http://127.0.0.1:${bindPort}`;
  const androidEmulatorUrl = `http://10.0.2.2:${bindPort}`;

  return {
    bind: `http://${bindHost}:${bindPort}`,
    local: localUrl,
    iosSimulator: localUrl,
    androidEmulator: androidEmulatorUrl,
    physicalDevice: `http://<mac-lan-ip>:${bindPort}`
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createAddressSuggestionId(): `addr_${string}` {
  return `addr_${randomBytes(10).toString("hex")}`;
}

function createHouseDraftId(): `house_draft_${string}` {
  return `house_draft_${randomBytes(10).toString("hex")}`;
}

function createHomeCardId(): `card_${string}` {
  return `card_${randomBytes(10).toString("hex")}`;
}

function createOverviewPreviewCardId(): `overview_card_${string}` {
  return `overview_card_${randomBytes(10).toString("hex")}`;
}

function extractPostalCodeAndCity(label: string) {
  const match = /,\s*(\d{4})\s+([^,]+)$/.exec(label);

  if (!match) {
    return {};
  }

  return {
    postalCode: match[1],
    city: match[2]?.trim()
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

  if (request.method === "POST" && request.url === "/v1/house-drafts") {
    void (async () => {
      try {
        const selectedAddress = await readJsonBody(request);
        const parsedAddress =
          selectedAddressInputSchema.safeParse(selectedAddress);

        if (!parsedAddress.success || parsedAddress.data.source !== "DAWA") {
          writeJson(
            response,
            400,
            apiErrorSchema.parse({
              code: "house_draft_selected_address_invalid",
              message:
                "House draft requires a selected DAWA address with sourceAddressId and label."
            })
          );
          return;
        }

        const now = new Date().toISOString();
        const validityEnd = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 14
        ).toISOString();
        const { postalCode, city } = extractPostalCodeAndCity(
          parsedAddress.data.label
        );

        const body = houseDraftResponseSchema.parse({
          houseDraft: {
            id: createHouseDraftId(),
            status: "draft",
            selectedAddress: parsedAddress.data,
            profile: {
              displayName: parsedAddress.data.label,
              addressLabel: parsedAddress.data.label,
              postalCode,
              city,
              propertyType: "UNKNOWN"
            },
            sourceReferences: [
              {
                source: parsedAddress.data.source,
                sourceAddressId: parsedAddress.data.sourceAddressId,
                sourceAccessAddressId:
                  parsedAddress.data.sourceAccessAddressId
              }
            ],
            createdAt: now,
            skeleton: true
          },
          cards: [
            {
              id: createHomeCardId(),
              type: "MISSING_DOCUMENT",
              title: "Skeleton: find husets vigtigste dokumenter",
              shortExplanation:
                "Development-only card for validating the house draft contract.",
              severity: "notice",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later help collect relevant house documentation."
            },
            {
              id: createHomeCardId(),
              type: "SEASONAL_RECOMMENDATION",
              title: "Skeleton: første sæsonråd",
              shortExplanation:
                "Development-only recommendation placeholder. Not production advice.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later provide backend-driven seasonal guidance."
            },
            {
              id: createHomeCardId(),
              type: "TASK_REMINDER",
              title: "Skeleton: første vedligeholdelsesopgave",
              shortExplanation:
                "Development-only task reminder placeholder. No task has been created.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later generate maintenance tasks from backend rules."
            }
          ],
          generatedAt: now,
          skeleton: true
        });

        writeJson(response, 201, body);
      } catch {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "house_draft_request_invalid",
            message: "House draft request body must be valid JSON."
          })
        );
      }
    })();
    return;
  }

  const overviewPreviewMatch = /^\/v1\/house-drafts\/([^/]+)\/overview-preview$/.exec(
    request.url ?? ""
  );

  if (request.method === "GET" && overviewPreviewMatch) {
    const parsedHouseDraftId = houseDraftIdSchema.safeParse(
      overviewPreviewMatch[1]
    );

    if (!parsedHouseDraftId.success) {
      writeJson(
        response,
        400,
        apiErrorSchema.parse({
          code: "house_draft_overview_preview_id_invalid",
          message: "Overview preview requires a valid house_draft_ ID."
        })
      );
      return;
    }

    const now = new Date().toISOString();
    const body = houseDraftOverviewPreviewResponseSchema.parse({
      version: "house_draft_overview_preview.v1",
      houseDraftId: parsedHouseDraftId.data,
      draftStatus: "draft",
      dataConfidence: "not_verified",
      title: "Mit hus",
      subtitle: "Overblik",
      warningTitle: "Ikke verificerede boligdata",
      warningBody:
        "Dette er et første preview baseret på dit house draft. Matriva har endnu ikke verificeret boligdata mod live BBR/Datafordeler.",
      sections: [
        {
          kind: "overview",
          title: "Overblik",
          intro:
            "Et roligt startpunkt for huset, indtil verificerede boligdata er klar.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Første husprofil",
              body:
                "Matriva har oprettet et midlertidigt draft, så du kan se produktets struktur uden verificerede boligdata.",
              statusLabel: "Ikke verificeret"
            }
          ]
        },
        {
          kind: "documents",
          title: "Dokumenter",
          intro:
            "Dokumentområdet er synligt som preview, men upload og arkiv er ikke aktiveret endnu.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Dokumentarkiv kommer senere",
              body:
                "Her vil Matriva samle relevante dokumenter, når dokumentfunktionen bliver tilføjet.",
              statusLabel: "Kommer senere",
              cta: {
                label: "Upload dokument",
                enabled: false,
                reason: "Dokumentupload er ikke implementeret i dette preview."
              }
            }
          ]
        },
        {
          kind: "maintenance",
          title: "Vedligehold",
          intro:
            "Vedligehold vises som backend-styret preview uden oprettede opgaver.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Vedligeholdsplan kommer senere",
              body:
                "Når verificerede data og regler er klar, kan backend foreslå relevante vedligeholdspunkter.",
              statusLabel: "Ingen opgaver oprettet",
              cta: {
                label: "Opret opgave",
                enabled: false,
                reason:
                  "Vedligeholdelsesopgaver er ikke implementeret i dette preview."
              }
            }
          ]
        },
        {
          kind: "next_actions",
          title: "Mangler / næste handling",
          intro:
            "Næste handlinger hjælper med at vise, hvad der mangler før et rigtigt husoverblik.",
          cards: [
            {
              id: createOverviewPreviewCardId(),
              title: "Afvent verificering af boligdata",
              body:
                "Det næste rigtige skridt er en backend-ejet verificering, før Matriva må præsentere boligdata som korrekte.",
              statusLabel: "Ikke verificeret"
            }
          ]
        }
      ],
      generatedAt: now,
      skeleton: true
    });

    writeJson(response, 200, body);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/house-drafts/enrich") {
    void (async () => {
      try {
        const payload = await readJsonBody(request);
        const parsedRequest = enrichHouseDraftRequestSchema.safeParse(payload);

        if (
          !parsedRequest.success ||
          parsedRequest.data.selectedAddress.source !== "DAWA" ||
          !houseDraftIdSchema.safeParse(parsedRequest.data.houseDraftId).success
        ) {
          writeJson(
            response,
            400,
            apiErrorSchema.parse({
              code: "house_draft_enrichment_request_invalid",
              message:
                "House draft enrichment requires a house_draft_ ID and selected DAWA address references."
            })
          );
          return;
        }

        const now = new Date().toISOString();
        const validityEnd = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 14
        ).toISOString();
        const datafordelerStatus = getDatafordelerConfigStatus();
        const datafordelerWarning =
          datafordelerStatus.authMode === "unsupported"
            ? {
                code: "unsupported_auth_mode",
                message:
                  "BBR/Datafordeler enrichment is unavailable for this API configuration."
              }
            : (datafordelerStatus.authMode === "api_key" ||
                  datafordelerStatus.authMode === "oauth") &&
                datafordelerStatus.baseUrlConfigured &&
                datafordelerStatus.apiKeyConfigured
              ? {
                  code: "credentials_configured_not_implemented",
                  message:
                    "BBR/Datafordeler credentials are configured, but live enrichment is not implemented yet."
                }
              : {
                  code: "credentials_missing",
                  message:
                    "BBR/Datafordeler enrichment is unavailable until API credentials are configured."
                };

        // TODO: Replace this skeleton branch with a server-side Datafordeler adapter.
        const body = enrichHouseDraftResponseSchema.parse({
          houseDraftId: parsedRequest.data.houseDraftId,
          enrichment: {
            status: "skeleton",
            source: {
              source: "BBR_DATAFORDELER",
              label: "BBR/Datafordeler",
              sourceAccessAddressId:
                parsedRequest.data.selectedAddress.sourceAccessAddressId,
              sourceAddressId: parsedRequest.data.selectedAddress.sourceAddressId,
              verificationStatus: "not_verified",
              integrationStatus: datafordelerWarning.code,
              skeleton: true
            },
            property: {
              propertyType: "UNKNOWN"
            },
            buildings: [],
            units: [],
            warnings: [
              datafordelerWarning.message,
              "Skeleton response must not be treated as verified BBR data."
            ],
            warningDetails: [
              datafordelerWarning,
              {
                code: "skeleton_not_verified",
                message:
                  "Skeleton response must not be treated as verified BBR data."
              }
            ],
            generatedAt: now,
            skeleton: true
          },
          profilePreview: {
            displayName: parsedRequest.data.selectedAddress.label,
            addressLabel: parsedRequest.data.selectedAddress.label,
            propertyType: "UNKNOWN"
          },
          cards: [
            {
              id: createHomeCardId(),
              type: "SYSTEM_NOTICE",
              title: "Skeleton: boligdata kan forbedre planen senere",
              shortExplanation:
                "Development-only card for validating the BBR/Datafordeler enrichment contract.",
              severity: "info",
              action: {
                label: "No action",
                target: { kind: "none" }
              },
              validFrom: now,
              validTo: validityEnd,
              audience: {
                countryCode: "DK",
                propertyTypes: ["UNKNOWN"]
              },
              minAppVersion: "0.1.0",
              fallbackText:
                "Matriva will later use backend-owned BBR enrichment to make maintenance cards more relevant."
            }
          ],
          generatedAt: now,
          skeleton: true
        });

        writeJson(response, 200, body);
      } catch {
        writeJson(
          response,
          400,
          apiErrorSchema.parse({
            code: "house_draft_enrichment_body_invalid",
            message: "House draft enrichment body must be valid JSON."
          })
        );
      }
    })();
    return;
  }

  writeJson(response, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  const urls = devUrlsForHost(host, port);

  console.log(`Matriva API listening on ${urls.bind}`);
  console.log(`Local health: ${urls.local}/health`);
  console.log(`iOS simulator: ${urls.iosSimulator}`);
  console.log(`Android emulator: ${urls.androidEmulator}`);
  console.log(`Physical device: ${urls.physicalDevice} when HOST=0.0.0.0`);
});
