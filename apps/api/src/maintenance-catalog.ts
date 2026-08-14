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

export type MaintenanceCatalogApplicabilityRule =
  | { type: "UNIVERSAL" }
  | { type: "REQUIRES_COMPONENT"; componentKey: string; excludesComponentKey?: string }
  | { type: "EXCLUDES_COMPONENT"; componentKey: string }
  | { type: "ENRICHED_BY_FACTS"; factKeys: ReadonlyArray<string> };

// `eligibilityRules` is retained as the persisted column name for backwards
// compatibility with the existing admin/content model. The V1 contract is
// the explicit applicability vocabulary above.
export type MaintenanceCatalogEligibilityRule = MaintenanceCatalogApplicabilityRule;

export type MaintenanceCatalogItem = {
  catalogKey: string;
  catalogVersion: string;
  title: string;
  shortDescription: string;
  season: MaintenanceSeason;
  recommendedPeriod: MaintenanceCatalogPeriod;
  defaultRecurrenceInterval: MaintenanceRecurrenceInterval;
  priority: MaintenanceCatalogPriority;
  eligibilityRules: MaintenanceCatalogEligibilityRule;
  disclaimerClass: MaintenanceCatalogDisclaimerClass;
  isActive: boolean;
};

type CatalogSeed = Omit<MaintenanceCatalogItem, "catalogVersion" | "eligibilityRules" | "recommendedPeriod"> & {
  applicability?: MaintenanceCatalogApplicabilityRule;
  recommendedPeriod?: MaintenanceCatalogPeriod;
};

function catalogItem(seed: CatalogSeed): MaintenanceCatalogItem {
  return {
    ...seed,
    catalogVersion: MAINTENANCE_CATALOG_VERSION,
    recommendedPeriod: seed.recommendedPeriod ?? { type: "all_year" },
    eligibilityRules: seed.applicability ?? { type: "UNIVERSAL" }
  };
}

export const maintenanceCatalogItems: ReadonlyArray<MaintenanceCatalogItem> = [
  catalogItem({ catalogKey: "smoke_alarm_check", title: "Kontroller røgalarmer", shortDescription: "Test røgalarmer, batterier og producentens anbefalede funktioner.", season: "all_year", defaultRecurrenceInterval: "half_yearly", priority: "high", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "visible_moisture_check", title: "Kontroller synlige tegn på fugt", shortDescription: "Se efter misfarvninger, lugt og andre synlige tegn på fugt.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "gutters_clean", title: "Rens tagrender", shortDescription: "Fjern blade og snavs, så regnvand kan ledes væk.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "half_yearly", priority: "normal", applicability: { type: "ENRICHED_BY_FACTS", factKeys: ["gutters.material"] }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "downpipes_check", title: "Kontroller nedløbsrør", shortDescription: "Se efter blokeringer, utætheder og løse samlinger.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "roof_flashings_visual_check", title: "Kontroller tag og inddækninger", shortDescription: "Gennemgå taget fra et sikkert sted for synlige skader.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "window_door_joints_check", title: "Efterse fuger omkring vinduer og døre", shortDescription: "Se efter revner og åbninger, hvor vand eller træk kan trænge ind.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "facade_visual_check", title: "Kontroller facade for revner og skader", shortDescription: "Gennemgå facaden for revner, afskalninger og andre skader.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "visible_pipes_leak_check", title: "Kontroller synlige rør for lækager", shortDescription: "Se efter fugt, dryp og misfarvninger ved synlige rør.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "outdoor_water_frost_prepare", title: "Klargør udendørs vandinstallationer til frost", shortDescription: "Gennemgå udendørs haner og vandinstallationer før frost.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 10, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "terrain_drainage_check", title: "Kontroller terræn og afvanding nær huset", shortDescription: "Se efter vand, der samler sig tæt på huset.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "outdoor_drain_grates_clean", title: "Rens udendørs afløbsriste", shortDescription: "Fjern blade og snavs fra synlige afløbsriste.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "wetroom_joints_check", title: "Kontroller fuger i vådrum", shortDescription: "Se efter revner, løse fuger og misfarvninger i vådrum.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "roof_surface_check", title: "Efterse tagfladen", shortDescription: "Se efter løse, knækkede eller forskudte tagdele.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "ENRICHED_BY_FACTS", factKeys: ["bbr.roof.material_code"] }, disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "roof_moss_and_growth_check", title: "Kontroller mos og belægninger på tag", shortDescription: "Vurder mos og belægninger uden at beskadige tagmaterialet.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "every_2_years", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "roof" }, disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "chimney_and_flashing_check", title: "Efterse skorsten og inddækning", shortDescription: "Se efter synlige skader omkring skorsten og inddækning.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "gutter_joints_check", title: "Efterse samlinger i tagrender", shortDescription: "Kontroller samlinger for utætheder og forskydninger.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "facade_mortar_check", title: "Kontroller mørtelfuger i facade", shortDescription: "Se efter udvaskede, revnede eller løse mørtelfuger.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "every_5_years", priority: "normal", applicability: { type: "ENRICHED_BY_FACTS", factKeys: ["bbr.facade.material_code"] }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "facade_surface_clean_check", title: "Vurder facade og overfladebehandling", shortDescription: "Vurder om facadeoverfladen er slidt eller beskadiget.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "every_5_years", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "facade" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "window_seals_check", title: "Kontroller vinduestætninger", shortDescription: "Se efter træk, sprækker og svigtende tætningslister.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "every_2_years", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "door_hardware_and_security_check", title: "Kontroller døre og beslag", shortDescription: "Test låse, hængsler, greb og tætningslister.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "foundation_crack_check", title: "Kontroller fundament for revner", shortDescription: "Se efter nye eller voksende revner omkring sokkel og fundament.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "basement_damp_check", title: "Kontroller kælder for fugt", shortDescription: "Se efter fugt, lugt og misfarvninger i kælder eller krybekælder.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "basement" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "basement_ventilation_check", title: "Kontroller ventilation i kælder", shortDescription: "Kontroller luftskifte og synlige ventilationsåbninger.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "basement" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "terrain_slope_check", title: "Kontroller terrænets fald fra huset", shortDescription: "Se om overfladevand ledes væk fra huset.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "every_2_years", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "drain_inspection_check", title: "Vurder dræn og brønde", shortDescription: "Se efter tegn på tilstopning eller vand omkring brønde.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "every_5_years", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "drainage" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "sewer_backflow_check", title: "Kontroller risiko for kloaktilbageløb", shortDescription: "Vurder synlige tegn på tilbageløb og afløbsproblemer.", season: "all_year", defaultRecurrenceInterval: "every_5_years", priority: "normal", applicability: { type: "ENRICHED_BY_FACTS", factKeys: ["bbr.ground.sewer"] }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "water_stopcock_check", title: "Find og test hovedvandhanen", shortDescription: "Sørg for at hovedvandhanen kan lukkes ved en lækage.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "high", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "water_heater_safety_check", title: "Kontroller varmtvandsinstallation", shortDescription: "Se efter dryp, korrosion og unormal støj ved varmtvandsinstallation.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "drains_flow_check", title: "Kontroller afløb for langsomt flow", shortDescription: "Test synlige afløb og reager på lugt eller langsomt flow.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "electrical_panel_visual_check", title: "Efterse eltavle visuelt", shortDescription: "Se efter varme, lugt, skader eller løse dæksler uden at åbne tavlen.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "high", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "outdoor_electrical_safety_check", title: "Kontroller udendørs el", shortDescription: "Se efter beskadigede kabler, stik og udendørs el-kapslinger.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "high", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "fire_extinguisher_check", title: "Kontroller brandslukker", shortDescription: "Kontroller placering, adgang og serviceindikator efter producentens anvisning.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "high", disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "wetroom_drain_check", title: "Rens og kontroller gulvafløb", shortDescription: "Fjern hår og snavs, og se efter tegn på dårlig afvanding.", season: "all_year", defaultRecurrenceInterval: "half_yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "wetroom" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "wetroom_seal_check", title: "Kontroller vådrummets tætninger", shortDescription: "Se efter svigtende elastiske fuger ved vådrummets samlinger.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "wetroom" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "heating_system_service", title: "Få varmeinstallationen efterset", shortDescription: "Følg producentens serviceinterval og få faglig hjælp ved behov.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "high", applicability: { type: "REQUIRES_COMPONENT", componentKey: "heating_system" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "radiator_valves_check", title: "Test radiatorventiler", shortDescription: "Kontroller at radiatorventiler kan bevæges og regulere varmen.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "central_heating" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "district_heating_unit_check", title: "Kontroller fjernvarmeunit", shortDescription: "Se efter lækager, trykafvigelser og servicebehov på fjernvarmeunit.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "district_heating" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "gas_boiler_service", title: "Service på gasfyr", shortDescription: "Følg serviceintervallet for gasfyr og få arbejdet udført af fagperson.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "high", applicability: { type: "REQUIRES_COMPONENT", componentKey: "gas_boiler", excludesComponentKey: "heat_pump" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "oil_boiler_service", title: "Service på oliefyr", shortDescription: "Følg serviceintervallet for oliefyr og få arbejdet udført fagligt.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "high", applicability: { type: "REQUIRES_COMPONENT", componentKey: "oil_boiler", excludesComponentKey: "heat_pump" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "heat_pump_service", title: "Service på varmepumpe", shortDescription: "Følg producentens service- og filterintervaller for varmepumpen.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "high", applicability: { type: "REQUIRES_COMPONENT", componentKey: "heat_pump" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "heat_pump_filter_check", title: "Kontroller varmepumpens filtre", shortDescription: "Kontroller og rengør filtre efter producentens anvisning.", season: "all_year", defaultRecurrenceInterval: "quarterly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "heat_pump" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "ventilation_filter_check", title: "Skift ventilationsfiltre", shortDescription: "Kontroller og skift filtre efter anlæggets interval.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "half_yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "ventilation" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "mechanical_ventilation_service", title: "Service på mekanisk ventilation", shortDescription: "Få mekanisk ventilation efterset og indreguleret efter behov.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "every_2_years", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "mechanical_ventilation" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "heat_recovery_check", title: "Kontroller varmegenvinding", shortDescription: "Kontroller varmeveksler, bypass og alarmer på ventilationsanlæg.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "heat_recovery" }, disclaimerClass: "professional_review", isActive: true }),
  catalogItem({ catalogKey: "ventilation_grilles_clean", title: "Rens ventilationsriste", shortDescription: "Fjern støv fra synlige ventilationsriste uden at ændre indreguleringen.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "ventilation" }, disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "indoor_climate_check", title: "Følg op på indeklima", shortDescription: "Læg mærke til temperatur, luftfugtighed, lugt og kondens.", season: "all_year", defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "outdoor_tap_check", title: "Kontroller udendørs vandhane", shortDescription: "Se efter dryp, frostskader og utætte samlinger.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "solar_panel_visual_check", title: "Efterse solceller visuelt", shortDescription: "Se efter synlige skader, snavs og løse kabler fra sikker afstand.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", applicability: { type: "REQUIRES_COMPONENT", componentKey: "solar_panels" }, disclaimerClass: "safety", isActive: true }),
  catalogItem({ catalogKey: "spring_house_check", title: "Forårstjek af huset", shortDescription: "Gå huset og de udvendige installationer igennem efter vinteren.", season: "spring", recommendedPeriod: { type: "month_range", startMonth: 3, endMonth: 5 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true }),
  catalogItem({ catalogKey: "autumn_house_check", title: "Efterårstjek af huset", shortDescription: "Gør hus og installationer klar til regn, kulde og frost.", season: "autumn", recommendedPeriod: { type: "month_range", startMonth: 9, endMonth: 11 }, defaultRecurrenceInterval: "yearly", priority: "normal", disclaimerClass: "general", isActive: true })
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

export type HouseApplicabilityState = {
  components: Readonly<Record<string, "present" | "absent" | "unknown">>;
  facts: Readonly<Record<string, unknown>>;
};

export type MaintenanceApplicabilityResult = {
  status: "relevant" | "possible" | "not_relevant";
  eligible: boolean;
  reason: string;
};

/**
 * Pure V1 evaluator. Missing facts/components deliberately produce `possible`
 * rather than `not_relevant`; only positive known absence can filter a
 * component-specific recommendation.
 */
export function evaluateMaintenanceApplicability(
  rule: MaintenanceCatalogApplicabilityRule,
  state: HouseApplicabilityState
): MaintenanceApplicabilityResult {
  if (rule.type === "UNIVERSAL") {
    return { status: "relevant", eligible: true, reason: "Generel anbefaling for huset." };
  }

  if (rule.type === "ENRICHED_BY_FACTS") {
    return {
      status: "relevant",
      eligible: true,
      reason: rule.factKeys.some((key) => state.facts[key] !== undefined)
        ? "Anbefalingen kan målrettes med kendte husdata."
        : "Generel anbefaling; ekstra husdata mangler endnu."
    };
  }

  const componentStatus = state.components[rule.componentKey];

  if (rule.type === "REQUIRES_COMPONENT") {
    if (rule.excludesComponentKey && state.components[rule.excludesComponentKey] === "present") {
      return { status: "not_relevant", eligible: false, reason: `Komponenten ${rule.excludesComponentKey} udelukker anbefalingen.` };
    }
    if (componentStatus === "present") {
      return { status: "relevant", eligible: true, reason: `Komponenten ${rule.componentKey} er registreret.` };
    }
    if (componentStatus === "absent") {
      return { status: "not_relevant", eligible: false, reason: `Komponenten ${rule.componentKey} er registreret som fraværende.` };
    }
    return { status: "possible", eligible: false, reason: `Det er endnu ukendt, om komponenten ${rule.componentKey} findes.` };
  }

  if (componentStatus === "present") {
    return { status: "not_relevant", eligible: false, reason: `Komponenten ${rule.componentKey} gør anbefalingen irrelevant.` };
  }
  if (componentStatus === "absent") {
    return { status: "relevant", eligible: true, reason: `Komponenten ${rule.componentKey} er registreret som fraværende.` };
  }
  return { status: "possible", eligible: false, reason: `Det er endnu ukendt, om komponenten ${rule.componentKey} findes.` };
}
