import type {
  HousePublicDataResponseV1,
  PublicBuilding,
  PublicDataWarning,
  PublicFloor,
  PublicUnit
} from "@matriva/shared";

import {
  PUBLIC_DATA_CODEBOOK_VERSION,
  lookupCode,
  normalizeExternalCode
} from "./codebooks.ts";
import { hashRawPayload } from "./datafordeler-client.ts";
import {
  PUBLIC_DATA_MAPPING_VERSION,
  type DatafordelerNode,
  type DatafordelerRawPayload,
  type PublicDataTarget
} from "./types.ts";

function stringValue(node: DatafordelerNode | null | undefined, key: string) {
  const value = node?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

function intValue(node: DatafordelerNode | null | undefined, key: string) {
  const value = node?.[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function relationNodes(node: DatafordelerNode | null | undefined, key: string) {
  const relation = node?.[key];

  if (
    typeof relation === "object" &&
    relation !== null &&
    !Array.isArray(relation) &&
    !("nodes" in relation)
  ) {
    return [relation as DatafordelerNode];
  }

  if (
    typeof relation !== "object" ||
    relation === null ||
    !("nodes" in relation) ||
    !Array.isArray((relation as { nodes?: unknown }).nodes)
  ) {
    return [];
  }

  return (relation as { nodes: unknown[] }).nodes.filter(
    (item): item is DatafordelerNode =>
      typeof item === "object" && item !== null && !Array.isArray(item)
  );
}

function addUnknownCodeWarnings(
  warnings: PublicDataWarning[],
  path: string,
  values: Array<{
    code: string;
    label: string | null;
    known: boolean;
    codebookKey: string;
  } | null>
) {
  for (const value of values) {
    if (value && !value.known) {
      warnings.push({
        code: "unknown_code",
        message: `Unknown public code ${value.code} for ${value.codebookKey}.`,
        path
      });
    }
  }
}

function heating(node: DatafordelerNode, prefix: "byg" | "enh") {
  const installation = lookupCode(
    "heatingInstallation",
    prefix === "byg"
      ? node.byg056Varmeinstallation
      : node.enh132Varmeinstallation
  );
  const source = lookupCode(
    "heatingSource",
    prefix === "byg" ? node.byg057Opvarmningsmiddel : node.enh133Opvarmningsmiddel
  );
  const supplementary = lookupCode(
    "supplementaryHeating",
    prefix === "byg" ? node.byg058SupplerendeVarme : node.enh105SupplerendeVarme
  );
  const sourceApplicability: "applicable" | "not_applicable" | "unknown" =
    installation?.code === "1" && source === null
      ? "not_applicable"
      : installation
        ? "applicable"
        : "unknown";

  return {
    installation,
    source,
    supplementary,
    sourceApplicability
  };
}

function inclusionForLifecycle(lifecycleCode: string | null) {
  if (!lifecycleCode) {
    return {
      includedInProductView: false,
      exclusionReason: "unsupported_lifecycle" as const
    };
  }

  if (lifecycleCode === "6") {
    return {
      includedInProductView: true,
      exclusionReason: null
    };
  }

  if (lifecycleCode === "2") {
    return {
      includedInProductView: false,
      exclusionReason: "projected" as const
    };
  }

  return {
    includedInProductView: false,
    exclusionReason: "non_constructed_lifecycle" as const
  };
}

function mapUnit(unit: DatafordelerNode, buildingId: string): PublicUnit {
  const lifecycle = lookupCode("lifecycle", unit.status) ?? {
    code: "missing",
    label: null,
    known: false,
    codebookKey: "lifecycle"
  };

  return {
    bbrUnitId: stringValue(unit, "id_lokalId") ?? "missing",
    buildingId,
    floorId: stringValue(unit, "etage"),
    lifecycle,
    use: lookupCode("unitUse", unit.enh020EnhedensAnvendelse),
    housingType: lookupCode("unitHousingType", unit.enh023Boligtype),
    areas: {
      totalAreaM2: intValue(unit, "enh026EnhedensSamledeAreal"),
      residentialAreaM2: intValue(unit, "enh027ArealTilBeboelse"),
      commercialAreaM2: intValue(unit, "enh028ArealTilErhverv"),
      physicalResidentialAreaM2: intValue(unit, "enh127FysiskArealTilBeboelse"),
      physicalCommercialAreaM2: intValue(unit, "enh128FysiskArealTilErhverv")
    },
    roomCount: intValue(unit, "enh031AntalVaerelser"),
    facilities: {
      toiletType: lookupCode("unitToilet", unit.enh032Toiletforhold),
      bathType: lookupCode("unitBath", unit.enh033Badeforhold),
      kitchenType: lookupCode("unitKitchen", unit.enh034Køkkenforhold),
      flushToiletCount: intValue(unit, "enh065AntalVandskyllendeToiletter"),
      bathroomCount: intValue(unit, "enh066AntalBadevaerelser")
    },
    heating: heating(unit, "enh")
  };
}

function mapFloor(floor: DatafordelerNode, buildingId: string): PublicFloor {
  const lifecycle = lookupCode("lifecycle", floor.status) ?? {
    code: "missing",
    label: null,
    known: false,
    codebookKey: "lifecycle"
  };

  return {
    bbrFloorId: stringValue(floor, "id_lokalId") ?? "missing",
    buildingId,
    lifecycle,
    designation: stringValue(floor, "eta006BygningensEtagebetegnelse"),
    type: lookupCode("floorType", floor.eta024EtageType),
    totalFloorAreaM2: intValue(floor, "eta020SamletArealAfEtage"),
    utilisedAtticAreaM2: intValue(floor, "eta021ArealAfUdnyttetDelAfTagetage"),
    basementAreaM2: intValue(floor, "eta022Kaelderareal"),
    legalResidentialBasementAreaM2: intValue(
      floor,
      "eta023ArealAfLovligBeboelseIKaelder"
    ),
    accessAreaM2: intValue(floor, "eta025Adgangsareal"),
    commercialBasementAreaM2: intValue(floor, "eta026ErhvervIKaelder")
  };
}

function unitLooksResidential(unit: PublicUnit) {
  return unit.areas.residentialAreaM2 !== null && unit.areas.residentialAreaM2 > 0;
}

function warningMakesResultPartial(warning: PublicDataWarning) {
  return (
    warning.code === "partial_building_details" ||
    warning.code === "missing_ground_relation" ||
    warning.code === "missing_bfe_number"
  );
}

export function mapPublicData(
  target: PublicDataTarget,
  raw: DatafordelerRawPayload
) {
  const warnings: PublicDataWarning[] = raw.partialErrors.map((error) => ({
    code:
      error.code === "missing_ground_relation"
        ? "missing_ground_relation"
        : "partial_building_details",
    message: error.message,
    ...(error.sourceId ? { path: error.sourceId } : {})
  }));
  const addressHouseNumber =
    relationNodes(raw.address, "adresseHarHusnummer")[0] ?? null;
  const property =
    relationNodes(raw.ground, "grundSamletFastEjendom")[0] ?? null;
  const addressBuildingId = stringValue(raw.addressBuilding, "id_lokalId");
  const bfeNumber = normalizeExternalCode(property?.bfeNummer);

  if (!bfeNumber) {
    warnings.push({
      code: "missing_bfe_number",
      message: "The public data source did not expose a BFE number."
    });
  }

  const parcelsById = new Map<string, HousePublicDataResponseV1["parcels"][number]>();
  const buildings = raw.buildings.map((building): PublicBuilding => {
    const buildingId = stringValue(building, "id_lokalId") ?? "missing";
    const lifecycle = lookupCode("lifecycle", building.status) ?? {
      code: "missing",
      label: null,
      known: false,
      codebookKey: "lifecycle"
    };
    const units = (raw.unitsByBuildingId[buildingId] ?? []).map((unit) =>
      mapUnit(unit, buildingId)
    );
    const floors = (raw.floorsByBuildingId[buildingId] ?? []).map((floor) =>
      mapFloor(floor, buildingId)
    );

    for (const parcel of relationNodes(building, "bygningJordstykke")) {
      const parcelId = stringValue(parcel, "id_lokalId");

      if (parcelId && !parcelsById.has(parcelId)) {
        parcelsById.set(parcelId, {
          cadastralParcelId: parcelId,
          cadastralNumber: stringValue(parcel, "matrikelnummer"),
          ownerDistrictId: stringValue(
            relationNodes(parcel, "ejerlav")[0],
            "id_lokalId"
          ),
          municipalityId: stringValue(
            relationNodes(parcel, "kommune")[0],
            "id_lokalId"
          )
        });
      }
    }

    const buildingHeating = heating(building, "byg");
    const buildingUse = lookupCode("buildingUse", building.byg021BygningensAnvendelse);
    const outerWall = lookupCode(
      "outerWallMaterial",
      building.byg032YdervæggensMateriale
    );
    const roof = lookupCode("roofMaterial", building.byg033Tagdækningsmateriale);
    const asbestos = lookupCode(
      "asbestosMaterial",
      building.byg034SupplerendeYdervæggensMateriale
    );

    addUnknownCodeWarnings(warnings, `buildings.${buildingId}`, [
      lifecycle,
      buildingUse,
      buildingHeating.installation,
      buildingHeating.source,
      buildingHeating.supplementary,
      outerWall,
      roof,
      asbestos
    ]);

    for (const unit of units) {
      if (
        unit.areas.residentialAreaM2 !== null &&
        unit.facilities.flushToiletCount === null
      ) {
        warnings.push({
          code: "optional_field_unavailable",
          message:
            "Flush toilet count is not available from the accepted Datafordeler GraphQL schema.",
          path: `units.${unit.bbrUnitId}.facilities.flushToiletCount`
        });
      }

      addUnknownCodeWarnings(warnings, `units.${unit.bbrUnitId}`, [
        unit.lifecycle,
        unit.use,
        unit.housingType,
        unit.facilities.toiletType,
        unit.facilities.bathType,
        unit.facilities.kitchenType,
        unit.heating.installation,
        unit.heating.source,
        unit.heating.supplementary
      ]);
    }

    return {
      bbrBuildingId: buildingId,
      number: intValue(building, "byg007Bygningsnummer"),
      isAddressBuilding: buildingId === addressBuildingId,
      lifecycle,
      use: buildingUse,
      inclusion: inclusionForLifecycle(lifecycle.code),
      constructionYear: intValue(building, "byg026Opfoerelsesaar"),
      remodelOrExtensionYear: intValue(building, "byg027OmTilbygningsaar"),
      materials: {
        outerWall,
        roof,
        asbestos
      },
      areas: {
        totalBuildingAreaM2: intValue(building, "byg038SamletBygningsareal"),
        residentialAreaM2: intValue(
          building,
          "byg039BygningensSamledeBoligAreal"
        ),
        commercialAreaM2: intValue(
          building,
          "byg040BygningensSamledeErhvervsAreal"
        ),
        footprintAreaM2: intValue(building, "byg041BebyggetAreal"),
        integratedGarageM2: intValue(building, "byg042ArealIndbyggetGarage"),
        integratedCarportM2: intValue(building, "byg043ArealIndbyggetCarport"),
        integratedOutbuildingM2: intValue(building, "byg044ArealIndbyggetUdhus"),
        integratedConservatoryM2: intValue(
          building,
          "byg045ArealIndbyggetUdestueEllerLign"
        ),
        otherAreaM2: intValue(building, "byg047ArealAfAffaldsrumITerrænniveau"),
        coveredAreaM2: intValue(
          building,
          "byg046SamletArealAfLukkedeOverdækningerPåBygningen"
        )
      },
      registeredFloorCount: intValue(building, "byg054AntalEtager"),
      heating: buildingHeating,
      units,
      floors
    };
  });

  const primaryBuilding =
    buildings.find((building) => building.isAddressBuilding) ?? null;
  const primaryUnitCandidates =
    primaryBuilding?.units.filter(unitLooksResidential) ?? [];
  const primaryUnit =
    primaryUnitCandidates.length === 1 ? primaryUnitCandidates[0] : null;

  if (!primaryBuilding) {
    warnings.push({
      code: "partial_building_details",
      message: "The address building was not returned among ground buildings."
    });
  }

  if (primaryUnitCandidates.length === 0) {
    warnings.push({
      code: "missing_primary_unit",
      message: "No residential unit candidate was found for the primary building."
    });
  }

  if (primaryUnitCandidates.length > 1) {
    warnings.push({
      code: "multiple_primary_unit_candidates",
      message:
        "Multiple residential unit candidates were found; user confirmation is required."
    });
  }

  const status =
    raw.partialErrors.length > 0 || warnings.some(warningMakesResultPartial)
      ? "partial"
      : primaryUnitCandidates.length > 1
        ? "ambiguous"
        : "success";
  const response: HousePublicDataResponseV1 = {
    contract: "house_public_data.v1",
    status,
    source: {
      provider: "datafordeler",
      register: "bbr",
      fetchedAt: new Date().toISOString(),
      effectiveAt: raw.effectiveAt,
      mappingVersion: PUBLIC_DATA_MAPPING_VERSION,
      codebookVersion: PUBLIC_DATA_CODEBOOK_VERSION
    },
    selection: {
      primaryBuildingId: primaryBuilding?.bbrBuildingId ?? null,
      primaryBuildingStatus: primaryBuilding
        ? "automatic_address_relation"
        : "not_found",
      primaryUnitId: primaryUnit?.bbrUnitId ?? null,
      primaryUnitStatus:
        primaryUnitCandidates.length === 1
          ? "automatic_unambiguous"
          : primaryUnitCandidates.length > 1
            ? "user_confirmation_required"
            : "not_found"
    },
    address: {
      label: stringValue(raw.address, "adressebetegnelse") ?? target.addressLabel,
      darAddressId: target.darAddressId,
      darAccessAddressId: target.darAccessAddressId,
      roadName: stringValue(
        relationNodes(addressHouseNumber, "vejstykke")[0],
        "vejnavn"
      ),
      houseNumberText: stringValue(addressHouseNumber, "husnummertekst"),
      postalCode: stringValue(
        relationNodes(addressHouseNumber, "postnummer")[0],
        "postnr"
      ),
      postalDistrict: stringValue(
        relationNodes(addressHouseNumber, "postnummer")[0],
        "navn"
      )
    },
    property: {
      bfeNumber,
      propertyType: lookupCode("propertyType", property?.sfeEjendomstype),
      status: lookupCode("lifecycle", property?.sfeStatus),
      municipalityCode: stringValue(
        relationNodes(property, "kommuneinddeling")[0],
        "kommunekode"
      ),
      assessmentPropertyNumber: stringValue(
        property,
        "vurderingsejendomsnummer"
      )
    },
    ground: raw.ground
      ? {
          bbrGroundId: stringValue(raw.ground, "id_lokalId") ?? "missing",
          waterSupply: lookupCode("groundWaterSupply", raw.ground.gru009Vandforsyning),
          sewer: lookupCode("groundSewer", raw.ground.gru010Afloebsforhold)
        }
      : null,
    parcels: [...parcelsById.values()],
    buildings,
    productBuildings: buildings.filter(
      (building) => building.inclusion.includedInProductView
    ),
    warnings
  };

  return {
    ...response,
    rawPayloadHash: hashRawPayload(raw)
  };
}
