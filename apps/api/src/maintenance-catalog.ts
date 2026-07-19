import type { MaintenanceRecurrenceInterval, MaintenanceSeason } from "@matriva/shared";

export const MAINTENANCE_CATALOG_VERSION = "2026-07.generic-maintenance-v1";

export type MaintenanceCatalogPriority = "low" | "normal" | "high";
export type MaintenanceCatalogDisclaimerClass =
  | "general"
  | "safety"
  | "professional_review";

export type MaintenanceCatalogPeriod =
  | { type: "all_year" }
  | { type: "season"; season: "spring" | "autumn" }
  | { type: "month_range"; startMonth: number; endMonth: number };

export type MaintenanceCatalogEligibilityRule = {
  type: "universal_house";
};

export type MaintenanceCatalogItem = {
  catalogKey: string;
  catalogVersion: string;
  title: string;
  shortDescription: string;
  componentKey:
    | "none"
    | "roof"
    | "facade"
    | "windows"
    | "doors"
    | "foundation"
    | "drainage"
    | "heating"
    | "plumbing"
    | "electricity"
    | "interior"
    | "garden"
    | "other";
  season: MaintenanceSeason;
  recommendedPeriod: MaintenanceCatalogPeriod;
  defaultRecurrenceInterval: MaintenanceRecurrenceInterval;
  priority: MaintenanceCatalogPriority;
  eligibilityRules: MaintenanceCatalogEligibilityRule;
  disclaimerClass: MaintenanceCatalogDisclaimerClass;
  isActive: boolean;
};

export const maintenanceCatalogItems: ReadonlyArray<MaintenanceCatalogItem> = [
  {
    catalogKey: "smoke_alarm_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller røgalarmer",
    shortDescription:
      "Kontrollér, at husets røgalarmer reagerer, og følg producentens anvisninger om test og batteriskift.",
    componentKey: "electricity",
    season: "all_year",
    recommendedPeriod: { type: "all_year" },
    defaultRecurrenceInterval: "half_yearly",
    priority: "high",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "safety",
    isActive: true
  },
  {
    catalogKey: "visible_moisture_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller synlige tegn på fugt",
    shortDescription:
      "Se efter misfarvninger, lugt eller andre synlige tegn på fugt i boligen. Undersøg årsagen nærmere eller kontakt en fagperson ved tvivl.",
    componentKey: "interior",
    season: "all_year",
    recommendedPeriod: { type: "all_year" },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "gutters_clean",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Rens tagrender",
    shortDescription:
      "Fjern blade og snavs fra tagrender, så regnvand lettere kan ledes væk fra huset.",
    componentKey: "drainage",
    season: "autumn",
    recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "downpipes_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller nedløbsrør",
    shortDescription:
      "Kontrollér synlige samlinger og afløb ved nedløbsrør, og se efter blokeringer eller utætheder.",
    componentKey: "drainage",
    season: "autumn",
    recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "roof_flashings_visual_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller tag og inddækninger",
    shortDescription:
      "Gennemgå taget fra et sikkert sted, og se efter synlige skader, løse dele eller problemer omkring inddækninger.",
    componentKey: "roof",
    season: "spring",
    recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "safety",
    isActive: true
  },
  {
    catalogKey: "window_door_joints_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Efterse fuger omkring vinduer og døre",
    shortDescription:
      "Se efter revner, løse fuger eller åbninger omkring vinduer og døre, hvor vand eller træk kan trænge ind.",
    componentKey: "windows",
    season: "spring",
    recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "facade_visual_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller facade for revner og skader",
    shortDescription:
      "Gennemgå facaden visuelt, og se efter nye revner, afskalninger eller andre synlige skader.",
    componentKey: "facade",
    season: "spring",
    recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "visible_pipes_leak_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller synlige rør for lækager",
    shortDescription:
      "Se efter fugt, dryp eller misfarvninger ved synlige vandrør og samlinger.",
    componentKey: "plumbing",
    season: "all_year",
    recommendedPeriod: { type: "all_year" },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "outdoor_water_frost_prepare",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Klargør udendørs vandinstallationer til frost",
    shortDescription:
      "Gennemgå udendørs haner, slanger og vandinstallationer før frost, og følg installationens anvisninger for vinterlukning.",
    componentKey: "plumbing",
    season: "autumn",
    recommendedPeriod: { type: "month_range", startMonth: 10, endMonth: 11 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "terrain_drainage_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller terræn og afvanding nær huset",
    shortDescription:
      "Se efter steder, hvor vand samler sig tæt på huset, eller hvor terræn og afvanding ikke leder vandet væk.",
    componentKey: "drainage",
    season: "autumn",
    recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "outdoor_drain_grates_clean",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Rens udendørs afløbsriste",
    shortDescription:
      "Fjern blade og snavs fra synlige udendørs afløbsriste, så vandet lettere kan løbe væk.",
    componentKey: "drainage",
    season: "autumn",
    recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  },
  {
    catalogKey: "wetroom_joints_check",
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    title: "Kontroller fuger i vådrum",
    shortDescription:
      "Se efter revner, løse fuger eller misfarvninger i synlige fuger omkring vådrummets overflader.",
    componentKey: "interior",
    season: "all_year",
    recommendedPeriod: { type: "all_year" },
    defaultRecurrenceInterval: "yearly",
    priority: "normal",
    eligibilityRules: { type: "universal_house" },
    disclaimerClass: "general",
    isActive: true
  }
];

export function recommendedPeriodLabel(period: MaintenanceCatalogPeriod) {
  if (period.type === "all_year") {
    return "Hele året";
  }

  if (period.type === "season") {
    return period.season === "spring" ? "Forår" : "Efterår";
  }

  const monthNames = [
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december"
  ];

  return `${monthNames[period.startMonth - 1]}-${monthNames[period.endMonth - 1]}`;
}
