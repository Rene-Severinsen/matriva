import assert from "node:assert/strict";

import { buildHousePublicDataSummary } from "../packages/shared/dist/index.js";
import {
  lookupCode,
  normalizeExternalCode
} from "../apps/api/dist/public-data/codebooks.js";
import { mapPublicData } from "../apps/api/dist/public-data/mapper.js";

const target = {
  kind: "house",
  id: "house_publicdatatest",
  userId: "usr_publicdatatest",
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
          postnummer: { nodes: [{ postnr: "9300", navn: "Sæby" }] },
          husnummerHarAdgangTilBygning: {
            nodes: [
              {
                id_lokalId: "4600cb6a-4f3c-4cb2-872a-3ecb746cf866",
                bygningGrund: {
                  nodes: [
                    {
                      id_lokalId: "90a31dae-fa35-43ee-9fc5-462029630500",
                      grundSamletFastEjendom: {
                        nodes: [{ bfeNummer: 5537536 }]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    }
  },
  addressBuilding: { id_lokalId: "4600cb6a-4f3c-4cb2-872a-3ecb746cf866" },
  ground: {
    id_lokalId: "90a31dae-fa35-43ee-9fc5-462029630500",
    grundSamletFastEjendom: {
      nodes: [{ bfeNummer: 5537536 }]
    }
  },
  buildings: [
    {
      id_lokalId: "4600cb6a-4f3c-4cb2-872a-3ecb746cf866",
      byg007Bygningsnummer: 1,
      status: 6,
      byg021BygningensAnvendelse: 120,
      byg026Opfoerelsesaar: 1970,
      byg038SamletBygningsareal: 160,
      byg039BygningensSamledeBoligAreal: 160,
      byg041BebyggetAreal: 80,
      byg056Varmeinstallation: 1,
      byg057Opvarmningsmiddel: null,
      byg058SupplerendeVarme: 2,
      bygningJordstykke: {
        nodes: [{ id_lokalId: "parcel-1", matrikelnummer: "1a" }]
      }
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
    "4600cb6a-4f3c-4cb2-872a-3ecb746cf866": [
      {
        id_lokalId: "unit-1",
        status: 6,
        enh020EnhedensAnvendelse: 120,
        enh026EnhedensSamledeAreal: 240,
        enh027ArealTilBeboelse: 160,
        enh028ArealTilErhverv: null,
        enh031AntalVaerelser: 6,
        enh065AntalVandskyllendeToiletter: 2,
        enh066AntalBadevaerelser: 1
      },
      {
        id_lokalId: "unit-2",
        status: 6,
        enh020EnhedensAnvendelse: 120,
        enh026EnhedensSamledeAreal: 20,
        enh027ArealTilBeboelse: 20
      }
    ],
    garage: [],
    projected: []
  },
  floorsByBuildingId: {
    "4600cb6a-4f3c-4cb2-872a-3ecb746cf866": [
      {
        id_lokalId: "floor-ground",
        status: 6,
        eta006BygningensEtagebetegnelse: "stue",
        eta020SamletArealAfEtage: 80
      },
      {
        id_lokalId: "floor-basement",
        status: 6,
        eta006BygningensEtagebetegnelse: "kælder",
        eta022Kaelderareal: 80,
        eta023ArealAfLovligBeboelseIKaelder: 0
      }
    ],
    garage: [],
    projected: []
  },
  partialErrors: []
};

assert.equal(lookupCode("buildingUse", 120)?.label, "Fritliggende enfamiliehus");
assert.equal(lookupCode("buildingUse", 999)?.known, false);
assert.equal(normalizeExternalCode(5537536), "5537536");

const mapped = mapPublicData(target, raw);
const primary = mapped.buildings[0];
const basement = primary.floors.find(
  (floor) => floor.bbrFloorId === "floor-basement"
);

assert.equal(mapped.property?.bfeNumber, "5537536");
assert.equal(mapped.selection.primaryBuildingStatus, "automatic_address_relation");
assert.equal(mapped.selection.primaryUnitStatus, "user_confirmation_required");
assert.equal(mapped.status, "ambiguous");
assert.equal(primary.areas.totalBuildingAreaM2, 160);
assert.equal(primary.units[0].areas.totalAreaM2, 240);
assert.equal(primary.units[0].areas.residentialAreaM2, 160);
assert.equal(primary.units[0].areas.commercialAreaM2, null);
assert.equal(basement?.basementAreaM2, 80);
assert.equal(basement?.legalResidentialBasementAreaM2, 0);
assert.equal(primary.heating.sourceApplicability, "not_applicable");
assert.equal(primary.heating.supplementary?.code, "2");
assert.equal(mapped.productBuildings.some((building) => building.bbrBuildingId === "projected"), false);
assert.equal(mapped.buildings.some((building) => building.bbrBuildingId === "projected"), true);

const optionalFieldRaw = structuredClone(raw);
optionalFieldRaw.unitsByBuildingId["4600cb6a-4f3c-4cb2-872a-3ecb746cf866"] = [
  {
    id_lokalId: "unit-1",
    status: 6,
    enh020EnhedensAnvendelse: 120,
    enh026EnhedensSamledeAreal: 160,
    enh027ArealTilBeboelse: 160,
    enh028ArealTilErhverv: null,
    enh031AntalVaerelser: 6,
    enh066AntalBadevaerelser: 1
  }
];
const optionalFieldMapped = mapPublicData(target, optionalFieldRaw);
const summary = buildHousePublicDataSummary(target.id, optionalFieldMapped);

assert.equal(summary.contract, "house_public_data_summary.v1");
assert.equal(summary.status, "available");
assert.equal(summary.sourceLabel, "Registreret i BBR");
assert.equal(summary.primary.title, "Fritliggende enfamiliehus");
assert.deepEqual(
  summary.primary.values.map((value) => value.key),
  [
    "use",
    "residential_area_m2",
    "construction_year",
    "room_count",
    "bathroom_count",
    "basement_area_m2",
    "heating_installation",
    "supplementary_heating",
    "other_existing_building_count"
  ]
);
assert.equal(
  summary.primary.values.some((value) => value.value === "Ukendt"),
  false
);
assert.equal(summary.existingOtherBuildingCount, 1);
assert.equal(summary.otherBuildings[0].title, "Garage");
assert.equal(summary.projectedBuildingCount, 1);
assert.equal(optionalFieldMapped.status, "success");
assert.equal(
  optionalFieldMapped.selection.primaryUnitStatus,
  "automatic_unambiguous"
);
assert.equal(
  optionalFieldMapped.selection.primaryUnitId,
  "unit-1"
);
assert.equal(
  optionalFieldMapped.buildings[0].units[0].facilities.flushToiletCount,
  null
);
assert.equal(
  optionalFieldMapped.warnings.some(
    (warning) => warning.code === "optional_field_unavailable"
  ),
  true
);

const partialRaw = structuredClone(optionalFieldRaw);
partialRaw.partialErrors = [
  {
    phase: "floors",
    sourceId: "4600cb6a-4f3c-4cb2-872a-3ecb746cf866",
    code: "partial_building_details",
    message: "Floors could not be fetched for a building."
  }
];
assert.equal(mapPublicData(target, partialRaw).status, "partial");

console.log("BBR public data mapping smoke passed.");
