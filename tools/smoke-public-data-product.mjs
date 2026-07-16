import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createMatrivaApiClient } from "../packages/api-client/dist/index.js";
import {
  buildHousePublicDataProfile,
  buildHousePublicDataSummary
} from "../packages/shared/dist/index.js";
import { mapPublicData } from "../apps/api/dist/public-data/mapper.js";

const target = {
  kind: "house",
  id: "house_productsmoke01",
  userId: "usr_productsmoke01",
  addressLabel: "Rosenstien 10, 9300 Sæby",
  darAddressId: "0a3f50c9-8c5e-32b8-e044-0003ba298018",
  darAccessAddressId: "0a3f509b-eddb-32b8-e044-0003ba298018"
};

const raw = {
  addressId: target.darAddressId,
  effectiveAt: "2026-07-16T00:00:00.000Z",
  address: {
    id_lokalId: target.darAddressId,
    adressebetegnelse: target.addressLabel,
    adresseHarHusnummer: {
      nodes: [
        {
          id_lokalId: target.darAccessAddressId,
          husnummertekst: "10",
          vejstykke: { nodes: [{ vejnavn: "Rosenstien" }] },
          postnummer: { nodes: [{ postnr: "9300", navn: "Sæby" }] }
        }
      ]
    }
  },
  addressBuilding: { id_lokalId: "primary-building" },
  ground: {
    id_lokalId: "ground-1",
    grundSamletFastEjendom: {
      nodes: [{ bfeNummer: 5537536 }]
    }
  },
  buildings: [
    {
      id_lokalId: "primary-building",
      byg007Bygningsnummer: 1,
      status: 6,
      byg021BygningensAnvendelse: 120,
      byg026Opfoerelsesaar: 1970,
      byg039BygningensSamledeBoligAreal: 160,
      byg056Varmeinstallation: 1,
      byg057Opvarmningsmiddel: 1,
      byg058SupplerendeVarme: 2
    },
    {
      id_lokalId: "garage",
      byg007Bygningsnummer: 2,
      status: 6,
      byg021BygningensAnvendelse: 910,
      byg038SamletBygningsareal: 33
    },
    {
      id_lokalId: "projected",
      byg007Bygningsnummer: 99,
      status: 2,
      byg021BygningensAnvendelse: 930,
      byg038SamletBygningsareal: 10
    }
  ],
  unitsByBuildingId: {
    "primary-building": [
      {
        id_lokalId: "unit-1",
        status: 6,
        enh020EnhedensAnvendelse: 120,
        enh026EnhedensSamledeAreal: 160,
        enh027ArealTilBeboelse: 160,
        enh031AntalVaerelser: 6,
        enh066AntalBadevaerelser: 1
      }
    ],
    garage: [],
    projected: []
  },
  floorsByBuildingId: {
    "primary-building": [
      {
        id_lokalId: "floor-basement",
        status: 6,
        eta022Kaelderareal: 0
      }
    ],
    garage: [],
    projected: []
  },
  partialErrors: []
};

function clone(value) {
  return structuredClone(value);
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

async function assertApiClientContract() {
  const calls = [];
  const client = createMatrivaApiClient({
    baseUrl: "http://matriva.test",
    getAccessToken: () => "access_token_product_smoke",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });

      if (url.endsWith("/v1/houses")) {
        return response({
          house: {
            id: target.id,
            ownerUserId: target.userId,
            addressLabel: target.addressLabel,
            dawaAddressId: target.darAddressId,
            status: "saved",
            dataConfidence: "not_verified",
            createdAt: "2026-07-16T00:00:00.000Z",
            updatedAt: "2026-07-16T00:00:00.000Z"
          }
        }, 201);
      }

      if (url.endsWith(`/v1/houses/${target.id}/public-data/refresh`)) {
        const publicData = mapPublicData(target, raw);

        return response({
          ...publicData,
          profile: buildHousePublicDataProfile(target.id, publicData)
        });
      }

      if (url.endsWith("/v1/app-bootstrap")) {
        const publicData = mapPublicData(target, raw);

        return response({
          user: {
            id: target.userId,
            email: "product-smoke@example.invalid",
            emailVerifiedAt: "2026-07-16T00:00:00.000Z",
            status: "active",
            createdAt: "2026-07-16T00:00:00.000Z",
            updatedAt: "2026-07-16T00:00:00.000Z",
            lastLoginAt: null
          },
          profile: {
            displayName: "Product Smoke",
            preferredLocale: "da-DK"
          },
          onboarding: { state: "complete" },
          houses: [
            {
              id: target.id,
              ownerUserId: target.userId,
              addressLabel: target.addressLabel,
              dawaAddressId: target.darAddressId,
              status: "saved",
              dataConfidence: "not_verified",
              createdAt: "2026-07-16T00:00:00.000Z",
              updatedAt: "2026-07-16T00:00:00.000Z"
            }
          ],
          activeHouseId: target.id,
          publicDataSummaries: [buildHousePublicDataSummary(target.id, publicData)],
          entitlements: {
            plan: "free",
            status: "free",
            features: {
              "documents.maxCount": { kind: "limit", value: 0 },
              "documents.maxStorageMb": { kind: "limit", value: 0 },
              "tasks.maxActive": { kind: "limit", value: 3 },
              "advisories.enabled": { kind: "boolean", value: false },
              "legalUpdates.enabled": { kind: "boolean", value: false },
              "sharing.enabled": { kind: "boolean", value: false },
              "export.enabled": { kind: "boolean", value: false },
              "advancedReminders.enabled": { kind: "boolean", value: false }
            },
            evaluatedAt: "2026-07-16T00:00:00.000Z"
          },
          cards: [],
          generatedAt: "2026-07-16T00:00:00.000Z"
        });
      }

      throw new Error(`Unexpected API-client URL: ${url}`);
    }
  });

  const saved = await client.createSavedHouse({
    selectedAddress: {
      source: "DAWA",
      sourceAddressId: target.darAddressId,
      sourceAccessAddressId: target.darAccessAddressId,
      label: target.addressLabel
    }
  });
  const refreshed = await client.refreshHousePublicData(saved.house.id);
  const bootstrap = await client.getAppBootstrap();

  assert.equal(saved.house.id, target.id);
  assert.equal(refreshed.contract, "house_public_data.v1");
  assert.equal(bootstrap.publicDataSummaries[0].contract, "house_public_data_summary.v1");
  assert(
    calls.some((call) => call.url.endsWith(`/v1/houses/${target.id}/public-data/refresh`)),
    "API client must support the public-data refresh route."
  );
}

async function assertProductSemantics() {
  const mapped = mapPublicData(target, raw);
  const summary = buildHousePublicDataSummary(target.id, mapped);
  const profile = buildHousePublicDataProfile(target.id, mapped);
  const basement = summary.primary.values.find(
    (value) => value.key === "basement_area_m2"
  );

  assert.equal(mapped.status, "success");
  assert.equal(summary.status, "available");
  assert.equal(profile.contract, "house_public_data_profile.v1");
  assert.equal(profile.topFacts.some((fact) => fact.key === "residential_area"), true);
  assert.equal(
    profile.sections.some((section) => section.key === "otherBuildings"),
    true
  );
  assert.equal(summary.existingOtherBuildingCount, 1);
  assert.equal(summary.projectedBuildingCount, 1);
  assert.equal(basement?.value, 0, "null/zero semantics must preserve a real 0.");
  assert.equal(
    summary.primary.values.some((value) => value.value === "Ukendt"),
    false,
    "Missing values must not be rendered as unknown placeholder values."
  );

  const partialRaw = clone(raw);
  partialRaw.partialErrors = [
    {
      phase: "floors",
      sourceId: "primary-building",
      code: "partial_building_details",
      message: "Floors could not be fetched for a building."
    }
  ];
  const partialSummary = buildHousePublicDataSummary(
    target.id,
    mapPublicData(target, partialRaw)
  );
  assert.equal(partialSummary.status, "partial");
  assert(partialSummary.primary.values.length > 0, "Partial data must still be useful.");

  const ambiguousRaw = clone(raw);
  ambiguousRaw.unitsByBuildingId["primary-building"].push({
    id_lokalId: "unit-2",
    status: 6,
    enh020EnhedensAnvendelse: 120,
    enh026EnhedensSamledeAreal: 40,
    enh027ArealTilBeboelse: 40,
    enh031AntalVaerelser: 2
  });
  const ambiguousSummary = buildHousePublicDataSummary(
    target.id,
    mapPublicData(target, ambiguousRaw)
  );
  assert.equal(ambiguousSummary.status, "ambiguous");
  assert.equal(
    ambiguousSummary.primary.values.some((value) => value.key === "room_count"),
    false,
    "Ambiguous summaries must not pick one residential unit arbitrarily."
  );

  const unknownRaw = clone(raw);
  unknownRaw.buildings[0].byg021BygningensAnvendelse = 999999;
  assert.doesNotThrow(() => mapPublicData(target, unknownRaw));

  const loadingSummary = buildHousePublicDataSummary(target.id, {
    contract: "house_public_data.v1",
    status: "fetching",
    source: {
      provider: "datafordeler",
      register: "bbr",
      fetchedAt: null,
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
    warnings: []
  });
  assert.equal(loadingSummary.status, "loading");
}

async function assertSourceSemantics() {
  const [server, service, repository, mobile] = await Promise.all([
    readFile("apps/api/src/server.ts", "utf8"),
    readFile("apps/api/src/public-data/service.ts", "utf8"),
    readFile("apps/api/src/public-data/repository.ts", "utf8"),
    readFile("apps/mobile/src/App.tsx", "utf8")
  ]);
  const createHouseRouteIndex = server.indexOf('request.method === "POST" && request.url === "/v1/houses"');
  const persistedHouseIndex = server.indexOf("const house = await createSavedHouse", createHouseRouteIndex);
  const triggerIndex = server.indexOf(
    "startHousePublicDataRefreshAfterHouseCreated",
    persistedHouseIndex
  );

  assert(
    createHouseRouteIndex >= 0 &&
      persistedHouseIndex > createHouseRouteIndex &&
      triggerIndex > persistedHouseIndex,
    "Auto-enrichment must start only after saved-house persistence succeeds."
  );
  assert(
    service.includes(".catch((error: unknown)") &&
      service.includes("new Map<string, Promise<HousePublicDataResponseV1>>()") &&
      service.includes("inProcessRefreshes.delete(refreshKey)"),
    "Auto-enrichment trigger must catch errors and shared refresh dedupe must clean up."
  );
  assert(
    repository.includes("publicDataStatusCanBecomeCurrent(normalized.status)") &&
      repository.includes("is_current") &&
      repository.includes("false"),
    "Repository must keep failed snapshots from becoming current."
  );
  assert(
    service.includes("previousUsableHousePublicData") &&
      service.includes("status !== \"not_found\""),
    "Refresh must return previous usable data for failed/unavailable refreshes."
  );
  assert(
    service.includes("\"provider_not_configured\"") &&
      service.indexOf("\"provider_not_configured\"") <
        service.indexOf("previousUsableHousePublicData(userId, houseId)"),
    "Provider-not-configured refreshes must be recorded before returning unavailable/current data."
  );
  assert(
    mobile.includes("apiClient.refreshHousePublicData") &&
      !mobile.includes("Datafordeler"),
    "Mobile must use the Matriva API and not Datafordeler directly."
  );
  assert(
    mobile.includes("Opdaterer...") &&
      mobile.includes("publicDataRefreshMessage") &&
      mobile.includes("loadingAction === \"publicData\""),
    "Mobile refresh must expose loading feedback, prevent duplicate refreshes, and show refresh result messages."
  );
}

await assertProductSemantics();
await assertApiClientContract();
await assertSourceSemantics();

console.log("Public data product smoke passed.");
