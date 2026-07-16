export const PUBLIC_DATA_CODEBOOK_VERSION = "2026-07-16.v1";

export type CodebookKey =
  | "buildingUse"
  | "lifecycle"
  | "outerWallMaterial"
  | "roofMaterial"
  | "asbestosMaterial"
  | "heatingInstallation"
  | "heatingSource"
  | "supplementaryHeating"
  | "unitUse"
  | "unitHousingType"
  | "unitToilet"
  | "unitBath"
  | "unitKitchen"
  | "floorType"
  | "groundWaterSupply"
  | "groundSewer"
  | "propertyType";

export type PublicCodeValue = {
  code: string;
  label: string | null;
  known: boolean;
  codebookKey: CodebookKey;
  deprecated?: boolean;
};

type CodebookEntry = {
  label: string;
  deprecated?: boolean;
};

const lifecycle = {
  "2": { label: "Projekteret" },
  "6": { label: "Opført" }
} satisfies Record<string, CodebookEntry>;

const buildingUse = {
  "120": { label: "Fritliggende enfamiliehus" },
  "910": { label: "Garage" },
  "930": { label: "Udhus" },
  "940": { label: "Drivhus" },
  "950": { label: "Fritliggende overdækning" }
} satisfies Record<string, CodebookEntry>;

const heatingInstallation = {
  "1": { label: "Fjernvarme/blokvarme" },
  "2": { label: "Centralvarme med én fyringsenhed" }
} satisfies Record<string, CodebookEntry>;

const heatingSource = {
  "7": { label: "Naturgas" }
} satisfies Record<string, CodebookEntry>;

const supplementaryHeating = {
  "2": { label: "Brændeovn eller lignende med skorsten" },
  "90": { label: "Ingen supplerende varme" }
} satisfies Record<string, CodebookEntry>;

const empty = {} satisfies Record<string, CodebookEntry>;

export const codebooks: Record<CodebookKey, Record<string, CodebookEntry>> = {
  buildingUse,
  lifecycle,
  outerWallMaterial: empty,
  roofMaterial: empty,
  asbestosMaterial: empty,
  heatingInstallation,
  heatingSource,
  supplementaryHeating,
  unitUse: buildingUse,
  unitHousingType: empty,
  unitToilet: empty,
  unitBath: empty,
  unitKitchen: empty,
  floorType: empty,
  groundWaterSupply: empty,
  groundSewer: empty,
  propertyType: empty
} satisfies Record<CodebookKey, Record<string, CodebookEntry>>;

export function normalizeExternalCode(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return String(value);
}

export function lookupCode(
  codebookKey: CodebookKey,
  value: unknown
): PublicCodeValue | null {
  const code = normalizeExternalCode(value);

  if (code === null) {
    return null;
  }

  const entry = codebooks[codebookKey][code];

  return {
    code,
    label: entry?.label ?? null,
    known: Boolean(entry),
    codebookKey,
    ...(entry?.deprecated ? { deprecated: true } : {})
  };
}
