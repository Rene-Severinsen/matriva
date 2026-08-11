export type HouseProfileSeed = {
  id: string;
  profileKey: string;
  title: string;
  description: string;
  referenceHouseLabel: string;
};

// Reference profiles are editorial reference universes, never automatic BBR
// classifications. BBR rule sets are only linked after their boundaries are
// explicitly approved.
export const houseProfileSeeds: ReadonlyArray<HouseProfileSeed> = [
  {
    id: "hprof_matriva_modern_2023",
    profileKey: "matriva_modern_2023",
    title: "Matriva Modern 2023",
    description:
      "House A visuelt/materialemæssigt referenceprofil baseret på den godkendte A01-reference: moderne dansk étplanshus fra 2023 med lyse mursten, mørkt tag, sorte vinduer, døre, tagrender og nedløb samt et minimalistisk have- og terrasseunivers. Canonical geometry er godkendt som den nuværende arkitektoniske source of truth.",
    referenceHouseLabel: "Matriva Modern 2023 · House A"
  }
];
