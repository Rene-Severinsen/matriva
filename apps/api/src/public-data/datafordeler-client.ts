import { createHash } from "node:crypto";

import { getDatafordelerRuntimeConfig } from "../config/datafordeler.ts";
import type { DatafordelerNode, DatafordelerRawPayload } from "./types.ts";

type GraphQlResponse = {
  data?: Record<string, unknown>;
  errors?: Array<{ message?: unknown }>;
};

export type DatafordelerTransport = (
  url: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export class DatafordelerProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const addressAndGroundQuery = `
  query MatrivaAddressGround($adresseId: String!) {
    DAR_Adresse(first: 1, virkningstid: __VIRKNINGSTID__, where: { id_lokalId: { eq: $adresseId } }) {
      nodes {
        id_lokalId
        adressebetegnelse
        adresseHarHusnummer {
          id_lokalId
          husnummertekst
          postnummer
          husnummerHarAdgangTilBygning {
            id_lokalId
            bygningGrund {
              id_lokalId
              gru009Vandforsyning
              gru010Afloebsforhold
              grundSamletFastEjendom {
                id_lokalId
                bfeNummer
                kommunekode
                vurderingsejendomsnummer
              }
            }
          }
        }
      }
    }
  }
`;

const buildingsQuery = `
  query MatrivaBuildings($groundId: String!) {
    BBR_Bygning(first: 100, virkningstid: __VIRKNINGSTID__, where: { grund: { eq: $groundId } }) {
      nodes {
        id_lokalId
        byg007Bygningsnummer
        byg021BygningensAnvendelse
        byg026Opfoerelsesaar
        byg027OmTilbygningsaar
        byg032YdervaeggensMateriale
        byg033Tagdaekningsmateriale
        byg034SupplerendeYdervaeggensMateriale
        byg038SamletBygningsareal
        byg039BygningensSamledeBoligAreal
        byg040BygningensSamledeErhvervsAreal
        byg041BebyggetAreal
        byg042ArealIndbyggetGarage
        byg043ArealIndbyggetCarport
        byg044ArealIndbyggetUdhus
        byg045ArealIndbyggetUdestueEllerLign
        byg046SamletArealAfLukkedeOverdaekningerPaaBygningen
        byg047ArealAfAffaldsrumITerraenniveau
        byg054AntalEtager
        byg056Varmeinstallation
        byg057Opvarmningsmiddel
        byg058SupplerendeVarme
        status
        bygningJordstykke { nodes { id_lokalId matrikelnummer } }
      }
    }
  }
`;

const unitsQuery = `
  query MatrivaUnits($buildingId: String!) {
    BBR_Enhed(first: 100, virkningstid: __VIRKNINGSTID__, where: { bygning: { eq: $buildingId } }) {
      nodes {
        id_lokalId
        bygning
        etage
        status
        enh020EnhedensAnvendelse
        enh023Boligtype
        enh026EnhedensSamledeAreal
        enh027ArealTilBeboelse
        enh028ArealTilErhverv
        enh030KildeTilEnhedensArealer
        enh031AntalVaerelser
        enh032Toiletforhold
        enh033Badeforhold
        enh034Koekkenforhold
        enh066AntalBadevaerelser
        enh068FlexboligTilladelsesart
        enh071AdresseFunktion
        enh102HerafAreal1
        enh103HerafAreal2
        enh104HerafAreal3
        enh127FysiskArealTilBeboelse
        enh128FysiskArealTilErhverv
      }
    }
  }
`;

const floorsQuery = `
  query MatrivaFloors($buildingId: String!) {
    BBR_Etage(first: 100, virkningstid: __VIRKNINGSTID__, where: { bygning: { eq: $buildingId } }) {
      nodes {
        id_lokalId
        bygning
        status
        eta006BygningensEtagebetegnelse
        eta020SamletArealAfEtage
        eta021ArealAfUdnyttetDelAfTagetage
        eta022Kaelderareal
        eta023ArealAfLovligBeboelseIKaelder
        eta026ErhvervIKaelder
      }
    }
  }
`;

function nodes(value: unknown): DatafordelerNode[] {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    if (!("nodes" in value)) {
      return [value as DatafordelerNode];
    }
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("nodes" in value) ||
    !Array.isArray((value as { nodes?: unknown }).nodes)
  ) {
    return [];
  }

  return (value as { nodes: unknown[] }).nodes.filter(
    (node): node is DatafordelerNode =>
      typeof node === "object" && node !== null && !Array.isArray(node)
  );
}

function firstNode(data: Record<string, unknown>, key: string) {
  return nodes(data[key])[0] ?? null;
}

function relationNodes(node: DatafordelerNode | null, key: string) {
  return node ? nodes(node[key]) : [];
}

function withVirkningstid(query: string, effectiveAtIso: string) {
  return query.replaceAll("__VIRKNINGSTID__", JSON.stringify(effectiveAtIso));
}

export function hashRawPayload(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export class DatafordelerClient {
  private readonly transport: DatafordelerTransport;

  constructor(transport: DatafordelerTransport = fetch) {
    this.transport = transport;
  }

  async enrichAddress(addressId: string, effectiveAt = new Date()) {
    const effectiveAtIso = effectiveAt.toISOString();
    const addressGround = await this.graphql(
      withVirkningstid(addressAndGroundQuery, effectiveAtIso),
      {
        adresseId: addressId
      }
    );
    const address = firstNode(addressGround, "DAR_Adresse");
    const houseNumber = relationNodes(address, "adresseHarHusnummer")[0] ?? null;
    const addressBuilding =
      relationNodes(houseNumber, "husnummerHarAdgangTilBygning")[0] ?? null;
    const ground = relationNodes(addressBuilding, "bygningGrund")[0] ?? null;
    const groundId = typeof ground?.id_lokalId === "string" ? ground.id_lokalId : null;

    if (!address) {
      throw new DatafordelerProviderError(
        "provider_not_found",
        "No public address data was found."
      );
    }

    if (!groundId) {
      return {
        addressId,
        effectiveAt: effectiveAtIso,
        address,
        addressBuilding,
        ground,
        buildings: [],
        unitsByBuildingId: {},
        floorsByBuildingId: {},
        partialErrors: [
          {
            phase: "ground",
            code: "missing_ground_relation",
            message: "Address building did not expose a ground relation."
          }
        ]
      } satisfies DatafordelerRawPayload;
    }

    const buildingsData = await this.graphql(
      withVirkningstid(buildingsQuery, effectiveAtIso),
      {
        groundId
      }
    );
    const buildings = nodes(buildingsData.BBR_Bygning);
    const unitsByBuildingId: Record<string, DatafordelerNode[]> = {};
    const floorsByBuildingId: Record<string, DatafordelerNode[]> = {};
    const partialErrors: DatafordelerRawPayload["partialErrors"] = [];

    for (const building of buildings) {
      const buildingId =
        typeof building.id_lokalId === "string" ? building.id_lokalId : null;

      if (!buildingId) {
        partialErrors.push({
          phase: "building_identity",
          code: "invalid_source_identity",
          message: "A building was returned without a local id."
        });
        continue;
      }

      const [units, floors] = await Promise.allSettled([
        this.graphql(withVirkningstid(unitsQuery, effectiveAtIso), {
          buildingId
        }),
        this.graphql(withVirkningstid(floorsQuery, effectiveAtIso), {
          buildingId
        })
      ]);

      if (units.status === "fulfilled") {
        unitsByBuildingId[buildingId] = nodes(units.value.BBR_Enhed);
      } else {
        partialErrors.push({
          phase: "units",
          sourceId: buildingId,
          code: "partial_building_details",
          message: "Units could not be fetched for a building."
        });
      }

      if (floors.status === "fulfilled") {
        floorsByBuildingId[buildingId] = nodes(floors.value.BBR_Etage);
      } else {
        partialErrors.push({
          phase: "floors",
          sourceId: buildingId,
          code: "partial_building_details",
          message: "Floors could not be fetched for a building."
        });
      }
    }

    return {
      addressId,
      effectiveAt: effectiveAtIso,
      address,
      addressBuilding,
      ground,
      buildings,
      unitsByBuildingId,
      floorsByBuildingId,
      partialErrors
    } satisfies DatafordelerRawPayload;
  }

  private async graphql(query: string, variables: Record<string, unknown>) {
    const { graphqlUrl, apiKey, timeoutMs } = getDatafordelerRuntimeConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = new URL(graphqlUrl);
    url.searchParams.set("apiKey", apiKey);

    try {
      const response = await this.transport(url.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new DatafordelerProviderError(
          response.status >= 500
            ? "provider_temporarily_unavailable"
            : "provider_request_failed",
          `Datafordeler request failed with status ${response.status}.`,
          response.status >= 500
        );
      }

      const payload = (await response.json()) as GraphQlResponse;

      if (payload.errors?.length) {
        throw new DatafordelerProviderError(
          "provider_graphql_error",
          "Datafordeler returned a GraphQL error."
        );
      }

      return payload.data ?? {};
    } catch (error) {
      if (error instanceof DatafordelerProviderError) {
        throw error;
      }

      throw new DatafordelerProviderError(
        "provider_temporarily_unavailable",
        "Datafordeler request could not be completed.",
        true
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
