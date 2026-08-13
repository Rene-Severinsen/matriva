import type { MaintenanceSeason } from "@matriva/shared";

export const USER_TASK_CLASSIFIER_VERSION = "2026-08.user-task-hybrid-v1";

export type TaskClassification = {
  clusterKey: string | null;
  label: string | null;
  normalizedText: string;
  method: "normalization" | "known_match" | "semantic";
  confidence: number;
  coverageCatalogKey: string | null;
  coverageCatalogVersion: string | null;
  season: MaintenanceSeason | null;
};

type KnownMatch = {
  catalogKey: string;
  label: string;
  terms: string[];
};

const knownMatches: KnownMatch[] = [
  { catalogKey: "smoke_alarm_check", label: "Kontroller røgalarmer", terms: ["røgalarm", "røgalarmer", "brandalarm"] },
  { catalogKey: "visible_moisture_check", label: "Kontroller synlige tegn på fugt", terms: ["fugt", "skimmelsvamp", "misfarvning", "fugtighed"] },
  { catalogKey: "gutters_clean", label: "Rens tagrender", terms: ["tagrende", "tagrender", "rendesten"] },
  { catalogKey: "downpipes_check", label: "Kontroller nedløbsrør", terms: ["nedløb", "nedløbsrør", "nedløbsroer", "nedløbsrør"] },
  { catalogKey: "roof_flashings_visual_check", label: "Kontroller tag og inddækninger", terms: ["tag", "tagsten", "inddækning", "inddaekning", "skorsten"] },
  { catalogKey: "window_door_joints_check", label: "Efterse fuger omkring vinduer og døre", terms: ["vindue", "vinduer", "dør", "døre", "fuge", "fuger"] },
  { catalogKey: "facade_visual_check", label: "Kontroller facade for revner og skader", terms: ["facade", "mur", "murværk", "murvaerk", "revne", "afskalning"] },
  { catalogKey: "visible_pipes_leak_check", label: "Kontroller synlige rør for lækager", terms: ["rør", "rørføring", "ror", "rørføring", "lækage", "utæt", "utaet"] },
  { catalogKey: "outdoor_water_frost_prepare", label: "Klargør udendørs vandinstallationer til frost", terms: ["udendørs vand", "udendoers vand", "hane", "slange", "frost"] },
  { catalogKey: "terrain_drainage_check", label: "Kontroller terræn og afvanding nær huset", terms: ["terræn", "terraen", "afvanding", "vand samler", "dræn", "draen"] },
  { catalogKey: "outdoor_drain_grates_clean", label: "Rens udendørs afløbsriste", terms: ["afløbsrist", "afloebsrist", "rist", "udendørs afløb", "udendoers afloeb"] },
  { catalogKey: "wetroom_joints_check", label: "Kontroller fuger i vådrum", terms: ["vådrum", "vaadrum", "badeværelse", "badevaerelse", "brusekabine"] }
];

const stopWords = new Set([
  "at", "af", "den", "det", "en", "et", "for", "i", "med", "og", "om", "på", "til", "ved", "vores", "min", "mit", "hus", "huset", "bolig", "boligen"
]);

const semanticAliases: Record<string, string> = {
  tjek: "kontroller",
  efterse: "kontroller",
  gennemgå: "kontroller",
  gennemgaa: "kontroller",
  rengør: "rens",
  rengor: "rens",
  fjern: "rens",
  undersøg: "kontroller",
  undersoeg: "kontroller",
  reparer: "reparation",
  udbedr: "reparation"
};

function fold(value: string) {
  return value
    .toLocaleLowerCase("da-DK")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function termsFor(value: string) {
  return fold(value)
    .split(/\s+/)
    .map((term) => semanticAliases[term] ?? term)
    .filter((term) => term.length > 2 && !stopWords.has(term))
    .map((term) => term.replace(/(?:ene|erne|er|en|et|e)$/u, ""))
    .filter(Boolean);
}

function seasonFor(value: string): MaintenanceSeason | null {
  const text = fold(value);
  if (text.includes("foraars") || text.includes("foraar")) return "spring";
  if (text.includes("sommer")) return "summer";
  if (text.includes("efteraar") || text.includes("efteraars")) return "autumn";
  if (text.includes("vinter") || text.includes("frost")) return "winter";
  return null;
}

export function classifyUserMaintenanceTask(title: string, description?: string | null): TaskClassification {
  const sourceText = [title, description ?? ""].filter(Boolean).join(" ");
  const normalizedText = termsFor(sourceText).join(" ");
  const foldedSource = fold(sourceText);
  const season = seasonFor(sourceText);

  const known = knownMatches.find((candidate) => {
    const hits = candidate.terms.filter((term) => foldedSource.includes(fold(term)));
    return hits.length > 0;
  });

  if (known) {
    return {
      clusterKey: `catalog:${known.catalogKey}`,
      label: known.label,
      normalizedText,
      method: "known_match",
      confidence: 0.96,
      coverageCatalogKey: known.catalogKey,
      coverageCatalogVersion: null,
      season
    };
  }

  const semanticTerms = [...new Set(termsFor(sourceText))];
  if (semanticTerms.length >= 2) {
    return {
      clusterKey: `semantic:${semanticTerms.join("_")}`,
      label: title.trim().slice(0, 160),
      normalizedText,
      method: semanticTerms.length >= 3 ? "semantic" : "normalization",
      confidence: semanticTerms.length >= 3 ? 0.72 : 0.64,
      coverageCatalogKey: null,
      coverageCatalogVersion: null,
      season
    };
  }

  return {
    clusterKey: null,
    label: null,
    normalizedText,
    method: "semantic",
    confidence: 0.25,
    coverageCatalogKey: null,
    coverageCatalogVersion: null,
    season
  };
}

