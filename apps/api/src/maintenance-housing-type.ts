import type { HousePublicDataResponseV1, PublicBuilding } from "@matriva/shared";

import type { MaintenanceHousingType } from "./generated/maintenance-recommendation-rules.ts";

const VILLA_BUILDING_USES = new Set(["110", "120", "121", "122"]);
const ROW_HOUSE_BUILDING_USES = new Set(["130", "131", "132"]);
const SUMMER_HOUSE_BUILDING_USES = new Set(["510", "540", "585"]);

function primaryBuilding(publicData: Pick<HousePublicDataResponseV1, "selection" | "productBuildings">): PublicBuilding | null {
  const buildings = publicData.productBuildings ?? [];
  if (publicData.selection.primaryBuildingStatus === "automatic_address_relation") {
    return buildings.find((building) => building.bbrBuildingId === publicData.selection.primaryBuildingId) ?? null;
  }
  return buildings.length === 1 ? buildings[0] ?? null : null;
}

/**
 * Maps only explicit BBR/public-data signals. Conflicting or incomplete data
 * returns unknown instead of guessing a housing type.
 */
export function deriveMaintenanceHousingType(
  publicData: Pick<HousePublicDataResponseV1, "selection" | "productBuildings" | "property"> | null | undefined
): MaintenanceHousingType {
  if (!publicData) return "unknown";
  const building = primaryBuilding(publicData);
  if (!building) return "unknown";

  const buildingUse = building.use?.code ?? null;
  const propertyType = publicData.property?.propertyType?.code ?? null;
  const primaryUnit = publicData.selection.primaryUnitStatus === "automatic_unambiguous"
    ? building.units.find((unit) => unit.bbrUnitId === publicData.selection.primaryUnitId) ?? null
    : null;
  const unitHousingType = primaryUnit?.housingType?.code ?? null;

  // enh023Boligtype=1 describes a dwelling unit with its own kitchen. It is
  // supporting evidence only and also occurs in single-family houses.
  if (propertyType === "3" || buildingUse === "140") return "apartment";
  if (unitHousingType === "5" || (buildingUse && SUMMER_HOUSE_BUILDING_USES.has(buildingUse))) return "summer_house";
  if (buildingUse && ROW_HOUSE_BUILDING_USES.has(buildingUse)) return "row_house";
  if (buildingUse && VILLA_BUILDING_USES.has(buildingUse)) return "villa";
  return "unknown";
}
