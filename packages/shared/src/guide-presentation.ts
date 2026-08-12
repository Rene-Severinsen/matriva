export type GuidePresentationSection = {
  sectionType: string;
  sectionKey: string;
  content: Record<string, unknown>;
};

export type GuidePresentationBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "label"; label: string; text: string };

const sectionLabels: Record<string, string> = {
  introduction: "Kort introduktion",
  why_it_matters: "Hvorfor det er vigtigt",
  overview: "Overblik",
  tools_materials: "Værktøj og materialer",
  safety: "Sikkerhed først",
  preparation: "Forberedelse",
  step: "Sådan gør du",
  common_mistakes: "Typiske fejl og problemtegn",
  completion_check: "Kontrollér resultatet",
  professional_help: "Hvornår skal du kontakte en fagperson?",
  print_note: "Praktisk note"
};

const fieldLabels: Record<string, string> = {
  instruction: "Sådan gør du",
  check: "Kontrollér",
  estimatedDurationMinutes: "Forventet tid",
  difficulty: "Sværhedsgrad",
  recommendedPeriods: "Anbefalede tidspunkter",
  suggestedProfessionals: "Fagpersoner"
};

const hiddenFields = new Set([
  "taskDefaults",
  "assetStatus",
  "referenceUniverse",
  "houseProfileAssessment",
  "images",
  "plannedHotspots",
  "coordinatePolicy",
  "validationStatus",
  "requiredScopes",
  "scopeFocus",
  "publicationRule"
]);

const listFields = new Set(["points", "warnings", "stopConditions", "checklist", "reasons", "items"]);

export function guideSectionLabel(sectionType: string, sectionKey?: string) {
  return sectionLabels[sectionType] ?? (sectionKey === "print_note" ? "Praktisk note" : "Vejledning");
}

export function guideSectionTitle(section: GuidePresentationSection & { title?: string | null }) {
  if (section.sectionKey === "overview") return "Overblik";
  if (section.sectionKey === "print_note") return "Praktisk note";
  return section.title?.trim() || guideSectionLabel(section.sectionType, section.sectionKey);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function listValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item.trim()];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = textValue(record.name) || textValue(record.label) || textValue(record.title);
    const purpose = textValue(record.purpose) || textValue(record.body) || textValue(record.description);
    if (name && purpose) return [`${name}: ${purpose}`];
    const text = name || purpose;
    return text ? [text] : [];
  });
}

export function presentGuideSection(section: GuidePresentationSection): GuidePresentationBlock[] {
  const blocks: GuidePresentationBlock[] = [];

  for (const [key, value] of Object.entries(section.content)) {
    if (hiddenFields.has(key)) continue;

    if (listFields.has(key)) {
      for (const item of listValue(value)) blocks.push({ kind: "bullet", text: item });
      continue;
    }

    if (key === "recommendedPeriods" && Array.isArray(value)) {
      const periods = value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const label = textValue((item as Record<string, unknown>).label);
        return label ? [label] : [];
      });
      if (periods.length) blocks.push({ kind: "label", label: "Anbefalede tidspunkter", text: periods.join(" og ") });
      continue;
    }

    if (key === "estimatedDurationMinutes" && typeof value === "number") {
      blocks.push({ kind: "label", label: "Forventet tid", text: `${value} minutter` });
      continue;
    }

    const text = textValue(value);
    if (!text) continue;
    if (key === "body") blocks.push({ kind: "paragraph", text });
    else if (fieldLabels[key]) blocks.push({ kind: "label", label: fieldLabels[key], text });
  }

  return blocks;
}
