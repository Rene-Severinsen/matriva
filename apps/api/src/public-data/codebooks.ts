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
  | "unitAreaSource"
  | "unitFlexHomePermission"
  | "unitAddressFunction"
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
  "6": { label: "Opført" },
  "10": { label: "Fejlregistreret" }
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

const outerWallMaterial = {
  "1": { label: "Mursten (tegl, kalksten, cementsten)" }
} satisfies Record<string, CodebookEntry>;

const roofMaterial = {
  "5": { label: "Fibercement, herunder asbest" }
} satisfies Record<string, CodebookEntry>;

const unitHousingType = {
  "1": { label: "Egentlig beboelseslejlighed" }
} satisfies Record<string, CodebookEntry>;

const unitAreaSource = {
  "1": { label: "Oplyst af ejer" }
} satisfies Record<string, CodebookEntry>;

const unitAddressFunction = {
  "0": { label: "Enhedens adresse" }
} satisfies Record<string, CodebookEntry>;

const unitToilet = {
  T: { label: "Vandskyllende toilet i enheden" }
} satisfies Record<string, CodebookEntry>;

const unitBath = {
  V: { label: "Badeværelse i enheden" }
} satisfies Record<string, CodebookEntry>;

const unitKitchen = {
  E: { label: "Eget køkken med afløb" }
} satisfies Record<string, CodebookEntry>;

const groundWaterSupply = {
  "1": { label: "Alment vandforsyningsanlæg" }
} satisfies Record<string, CodebookEntry>;

const groundSewer = {
  "10": { label: "Fælleskloakeret: spildevand + tag- og overfladevand" }
} satisfies Record<string, CodebookEntry>;

export const codebooks: Record<CodebookKey, Record<string, CodebookEntry>> = {
  buildingUse,
  lifecycle,
  outerWallMaterial,
  roofMaterial,
  asbestosMaterial: empty,
  heatingInstallation,
  heatingSource,
  supplementaryHeating,
  unitUse: buildingUse,
  unitHousingType,
  unitAreaSource,
  unitFlexHomePermission: empty,
  unitAddressFunction,
  unitToilet,
  unitBath,
  unitKitchen,
  floorType: empty,
  groundWaterSupply,
  groundSewer,
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
