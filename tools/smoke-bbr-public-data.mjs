import assert from "node:assert/strict";

import {
  buildHousePublicDataProfile,
  buildHousePublicDataSummary
} from "../packages/shared/dist/index.js";
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
      gru009Vandforsyning: 1,
      gru010Afloebsforhold: 10,
      grundSamletFastEjendom: {
      nodes: [{ bfeNummer: 5537536, kommunekode: "0840", vurderingsejendomsnummer: null }]
    }
  },
  buildings: [
    {
      id_lokalId: "4600cb6a-4f3c-4cb2-872a-3ecb746cf866",
      byg007Bygningsnummer: 1,
      status: 6,
      byg021BygningensAnvendelse: 120,
      byg026Opfoerelsesaar: 1970,
      byg032YdervaeggensMateriale: 1,
      byg033Tagdaekningsmateriale: 5,
      byg034SupplerendeYdervaeggensMateriale: 1,
      byg038SamletBygningsareal: 160,
      byg039BygningensSamledeBoligAreal: 160,
      byg041BebyggetAreal: 80,
      byg046SamletArealAfLukkedeOverdaekningerPaaBygningen: 6,
      byg047ArealAfAffaldsrumITerraenniveau: 2,
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
      status: 10,
      byg021BygningensAnvendelse: 910,
      byg026Opfoerelsesaar: 1000,
      byg038SamletBygningsareal: 33
    },
    {
      id_lokalId: "shed",
      byg007Bygningsnummer: 3,
      status: 6,
      byg021BygningensAnvendelse: 930,
      byg038SamletBygningsareal: 12
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
        enh023Boligtype: 1,
        enh026EnhedensSamledeAreal: 240,
        enh027ArealTilBeboelse: 160,
        enh028ArealTilErhverv: null,
        enh030KildeTilEnhedensArealer: 1,
        enh031AntalVaerelser: 6,
        enh032Toiletforhold: "T",
        enh033Badeforhold: "V",
        enh034Koekkenforhold: "E",
        enh065AntalVandskyllendeToiletter: 2,
        enh066AntalBadevaerelser: 1,
        enh071AdresseFunktion: 0
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
    shed: [],
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
    shed: [],
    projected: []
  },
  partialErrors: []
};

assert.equal(lookupCode("buildingUse", 120)?.label, "Fritliggende enfamiliehus");
assert.equal(lookupCode("buildingUse", 999)?.known, false);
assert.equal(lookupCode("lifecycle", 10)?.label, "Fejlregistreret");
assert.equal(lookupCode("lifecycle", 10)?.known, true);
assert.equal(
  lookupCode("outerWallMaterial", 1)?.label,
  "Mursten (tegl, kalksten, cementsten)"
);
assert.equal(
  lookupCode("roofMaterial", 5)?.label,
  "Fibercement, herunder asbest"
);
assert.equal(
  lookupCode("unitHousingType", 1)?.label,
  "Egentlig beboelseslejlighed"
);
assert.equal(lookupCode("unitAreaSource", 1)?.label, "Oplyst af ejer");
assert.equal(
  lookupCode("unitToilet", "T")?.label,
  "Vandskyllende toilet i enheden"
);
assert.equal(lookupCode("unitBath", "V")?.label, "Badeværelse i enheden");
assert.equal(lookupCode("unitKitchen", "E")?.label, "Eget køkken med afløb");
assert.equal(lookupCode("unitAddressFunction", 0)?.label, "Enhedens adresse");
assert.equal(
  lookupCode("groundWaterSupply", 1)?.label,
  "Alment vandforsyningsanlæg"
);
assert.equal(
  lookupCode("groundSewer", 10)?.label,
  "Fælleskloakeret: spildevand + tag- og overfladevand"
);
assert.equal(normalizeExternalCode(5537536), "5537536");

const mapped = mapPublicData(target, raw);
const primary = mapped.buildings[0];
const basement = primary.floors.find(
  (floor) => floor.bbrFloorId === "floor-basement"
);

assert.equal(mapped.property?.bfeNumber, "5537536");
assert.equal(mapped.property?.municipalityCode, "0840");
assert.equal(mapped.ground?.waterSupply?.known, true);
assert.equal(mapped.ground?.sewer?.known, true);
assert.equal(mapped.selection.primaryBuildingStatus, "automatic_address_relation");
assert.equal(mapped.selection.primaryUnitStatus, "user_confirmation_required");
assert.equal(mapped.status, "ambiguous");
assert.equal(primary.areas.totalBuildingAreaM2, 160);
assert.equal(primary.areas.coveredAreaM2, 6);
assert.equal(primary.materials.outerWall?.code, "1");
assert.equal(primary.materials.outerWall?.known, true);
assert.equal(primary.materials.roof?.code, "5");
assert.equal(primary.materials.roof?.known, true);
assert.equal(mapped.buildings[1].lifecycle.code, "10");
assert.equal(mapped.buildings[1].lifecycle.known, true);
assert.equal(mapped.buildings[1].lifecycle.label, "Fejlregistreret");
assert.equal(mapped.buildings[1].inclusion.exclusionReason, "non_constructed_lifecycle");
assert.equal(mapped.buildings[1].availability.heating, "registered_empty");
assert.equal(mapped.buildings[1].availability.materials, "registered_empty");
assert.equal(mapped.buildings[1].availability.coveredArea, "registered_empty");
assert.equal(primary.units[0].areas.totalAreaM2, 240);
assert.equal(primary.units[0].areas.residentialAreaM2, 160);
assert.equal(primary.units[0].areas.commercialAreaM2, null);
assert.equal(primary.units[0].housingType?.known, true);
assert.equal(primary.units[0].areaSource?.known, true);
assert.equal(primary.units[0].facilities.toiletType?.known, true);
assert.equal(primary.units[0].facilities.bathType?.known, true);
assert.equal(primary.units[0].facilities.kitchenType?.known, true);
assert.equal(primary.units[0].addressFunction?.known, true);
assert.equal(mapped.parcels[0].ownerDistrictId, null);
assert.equal(mapped.parcels[0].municipalityId, null);
assert.equal(mapped.parcels[0].availability?.ownerDistrict, "source_unavailable");
assert.equal(mapped.parcels[0].availability?.municipality, "source_unavailable");
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
const profile = buildHousePublicDataProfile(target.id, optionalFieldMapped);
const rawProfile = buildHousePublicDataProfile(target.id, mapped);

assert.equal(summary.contract, "house_public_data_summary.v1");
assert.equal(profile.contract, "house_public_data_profile.v1");
assert.equal(
  profile.sections.some((section) => section.key === "sourceAndQuality"),
  true
);
assert.equal(
  JSON.stringify(rawProfile).includes('"value":1000'),
  false,
  "Technical construction year 1000 must not be presented in product profile."
);
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
assert.equal(summary.otherBuildings[0].title, "Udhus");
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
