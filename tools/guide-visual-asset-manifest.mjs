export const houseProfile = {
  id: "hprof_matriva_modern_2023",
  key: "matriva_modern_2023"
};

const guide01DerivedProvenance = {
  referenceManifest: "docs/product/house-a-roof-edge-gutter-reference-manifest.json",
  sourceChecksums: {
    geometry: "5a1c2a6c5e5373b9a67c26e86ca9d2ba70bfc536b6209a9f65adfd13723e98cb",
    material: "f4e22be4388991d44b03c2253d86a69b2485cd3bb92a5a510820aa69826f6431",
    landscape: "c73ffb0dee23a28bfe788fd3cceab5afa6bc29941645e0fe60c5cbcefe49af39",
    a05: "3323073cf0783d8cde248722f510f25591718fcb5e4e4a4ea05ac8e76fc7e589"
  }
};

const master = (
  id,
  assetKey,
  sourcePath,
  category,
  viewOrComponent,
  altText,
  sourceType = "ai_generated",
  referenceAssetKeys = [],
  review = {}
) => ({
  id,
  assetKey,
  sourcePath,
  storagePath: `guides/matriva-modern-2023/masters/${sourcePath.split("/").at(-1)}`,
  category,
  viewOrComponent,
  purpose: "house_profile_master_reference",
  sourceType,
  altText,
  referenceAssetKeys,
  approvalStatus: review.approvalStatus ?? "superseded",
  canonicalUse: review.canonicalUse ?? "rejected_for_canonical_use",
  statusNote: review.statusNote ?? "House A pilot material preserved for QA and regression reference; not a canonical master."
});

const guide = (id, assetKey, sourcePath, viewOrComponent, altText, referenceAssetKeys, statusNote = "Rens tagrender pilot material preserved for QA and regression reference; not the final visual guide standard.", derivedProvenance = null) => ({
  id,
  assetKey,
  sourcePath,
  storagePath: `guides/matriva-modern-2023/rens-tagrender/${sourcePath.split("/").at(-1)}`,
  category: "gutter_downpipe",
  viewOrComponent,
  purpose: "guide_visual",
  sourceType: "ai_generated",
  altText,
  referenceAssetKeys,
  houseProfileId: houseProfile.id,
  guideId: "guide_rens_tagrender",
  guideKey: "rens_tagrender",
  guideVersion: "gver_rens_tagrender_v1",
  validationStatus: "not_requested",
  approvalStatus: "pilot",
  canonicalUse: "not_final_guide_standard",
  derivedProvenance,
  statusNote
});

export const visualAssets = [
  master(
    "gasset_ma23_a01_entry",
    "matriva_modern_2023_exterior_entry_master",
    "masters/a01-exterior-entry-original-v1.png",
    "exterior",
    "front_entrance",
    "Matriva Modern 2023 ved indgangen med lys murstensfacade, mørkt tag og sort dør.",
    "other",
    ["apps/website/public/images/HeroImage.png"],
    {
      approvalStatus: "approved",
      canonicalUse: "visual_material_reference",
      statusNote: "A01 is the only current approved House A visual/material reference; canonical geometry remains a separate task."
    }
  ),
  master("gasset_ma23_a02_front", "matriva_modern_2023_exterior_front_master", "masters/a02-exterior-front-oblique-v1.png", "exterior", "front_oblique", "Matriva Modern 2023 set skråt forfra med integreret sort garageport."),
  master("gasset_ma23_a03_garden", "matriva_modern_2023_exterior_garden_terrace_master", "masters/a03-exterior-garden-terrace-v1.png", "exterior", "garden_terrace", "Matriva Modern 2023 set fra have og terrasse med sorte terrassedøre."),
  master("gasset_ma23_a04_left", "matriva_modern_2023_exterior_left_master", "masters/a04-exterior-left-v2.png", "exterior", "left_side", "Matriva Modern 2023 set fra venstre side med lyse mursten, sorte vinduer og nedløb."),
  master("gasset_ma23_a05_right", "matriva_modern_2023_exterior_right_master", "masters/a05-exterior-right-v1.png", "exterior", "right_side", "Matriva Modern 2023 set fra højre side med sorte vinduer og tagrende."),
  master("gasset_ma23_a06_rear", "matriva_modern_2023_exterior_rear_master", "masters/a06-exterior-rear-v1.png", "exterior", "rear_long_side", "Matriva Modern 2023 set mod den lange bagside med terrasse og sorte tagrender."),
  master("gasset_ma23_a07_corner", "matriva_modern_2023_gutter_corner_master", "masters/a07-gutter-corner-v1.png", "gutter_downpipe", "gutter_corner", "Sort tagrende og nedløb ved hjørnet af Matriva Modern 2023."),
  master("gasset_ma23_a08_straight", "matriva_modern_2023_gutter_straight_master", "masters/a08-gutter-straight-v1.png", "gutter_downpipe", "gutter_straight", "Lige stræk af sort tagrende under mørkt tegltag på Matriva Modern 2023."),
  master("gasset_ma23_a09_top", "matriva_modern_2023_downpipe_top_master", "masters/a09-downpipe-top-v2.png", "gutter_downpipe", "downpipe_top", "Øvre samling mellem sort tagrende og nedløb på Matriva Modern 2023."),
  master("gasset_ma23_a10_foot", "matriva_modern_2023_downpipe_foot_master", "masters/a10-downpipe-foot-v1.png", "gutter_downpipe", "downpipe_foot", "Sort nedløb ved foden med sten langs facaden på Matriva Modern 2023."),
  master("gasset_ma23_a11_bath", "matriva_modern_2023_bathroom_overview_master", "masters/a11-bathroom-overview-v1.png", "wetroom", "bathroom_overview", "Matriva Modern 2023 badeværelse med varme beige fliser, glasbruser og mørkt vaskeskab."),
  master("gasset_ma23_a12_shower", "matriva_modern_2023_bathroom_shower_master", "masters/a12-bathroom-shower-v1.png", "wetroom", "shower_enclosure", "Bruseniche i Matriva Modern 2023 med beige fliser og mørkt armatur."),
  master("gasset_ma23_a13_hard", "matriva_modern_2023_bathroom_hard_joint_master", "masters/a13-bathroom-hard-joint-v1.png", "wetroom", "hard_grout_joint", "Intakte hårde fuger mellem beige badeværelsesfliser."),
  master("gasset_ma23_a14_soft", "matriva_modern_2023_bathroom_soft_joint_master", "masters/a14-bathroom-soft-corner-joint-v2.png", "wetroom", "soft_corner_joint", "Intakt blød fuge i et indvendigt flisehjørne i Matriva Modern 2023."),
  master("gasset_ma23_a15_floor", "matriva_modern_2023_bathroom_floor_wall_transition_master", "masters/a15-bathroom-floor-wall-transition-v1.png", "wetroom", "floor_wall_transition", "Intakt gulv-væg-overgang med blød fuge i Matriva Modern 2023."),
  guide("gasset_gutter_g02_problem", "rens_tagrender_problem_debris", "guides/rens-tagrender/g02-problem-debris-v1.png", "problem_debris", "Blade og organisk snavs i en sort tagrende på Matriva Modern 2023.", ["matriva_modern_2023_gutter_straight_master", "matriva_modern_2023_gutter_corner_master"]),
  guide("gasset_gutter_g03_cleaning", "rens_tagrender_cleaning", "guides/rens-tagrender/g03-cleaning-v1.png", "cleaning", "En behandsket hånd fjerner blade fra tagrenden på Matriva Modern 2023.", ["rens_tagrender_problem_debris", "matriva_modern_2023_gutter_straight_master"]),
  guide("gasset_gutter_g04_flow", "rens_tagrender_flow_check", "guides/rens-tagrender/g04-flow-check-v1.png", "flow_check", "Kontrolleret skylning mod nedløbet ved tagrendens hjørne på Matriva Modern 2023.", ["matriva_modern_2023_gutter_corner_master", "matriva_modern_2023_downpipe_top_master"]),
  guide("gasset_gutter_g05_result", "rens_tagrender_correct_result", "guides/rens-tagrender/g05-correct-result-v1.png", "correct_result", "Ren sort tagrende og frit nedløb ved lys murstensfacade på Matriva Modern 2023.", ["matriva_modern_2023_gutter_straight_master", "matriva_modern_2023_downpipe_foot_master"]),
  guide("gasset_gutter_g01_orientation_v1", "rens_tagrender_orientation_v1", "guides/rens-tagrender/g01-orientation-v1.png", "orientation", "House A med synlig sort tagrende og korrekt nedløb ved taghjørnet.", ["house_a_roof_edge_gutter_corner_reference_v1", "matriva_modern_2023_house_a05_canonical_render"], "Rens tagrender guide candidate generated from current House A references; human approval pending.", guide01DerivedProvenance),
  guide("gasset_gutter_g02_remove_debris_v1", "rens_tagrender_remove_debris_v1", "guides/rens-tagrender/g02-remove-debris-v1.png", "remove_debris", "En behandsket hånd fjerner løse blade fra den sorte tagrende på House A.", ["house_a_roof_edge_gutter_corner_reference_v1", "matriva_modern_2023_house_a05_canonical_render"], "Rens tagrender guide candidate generated from current House A references; human approval pending.", guide01DerivedProvenance),
  guide("gasset_gutter_g02_remove_debris_v2", "rens_tagrender_remove_debris_v2", "guides/rens-tagrender/g02-remove-debris-v2.png", "remove_debris", "En behandsket hånd fjerner løse blade og almindeligt tørt snavs fra den sorte tagrende på House A.", ["house_a_roof_edge_gutter_corner_reference_v1", "matriva_modern_2023_house_a05_canonical_render"], "Rens tagrender guide candidate generated from current House A references; human approval pending.", guide01DerivedProvenance),
  guide("gasset_gutter_g03_flow_downpipe_v1", "rens_tagrender_flow_downpipe_v1", "guides/rens-tagrender/g03-flow-downpipe-v1.png", "flow_downpipe", "Vand bevæger sig gennem House A's sorte tagrende mod det korrekte nedløb.", ["house_a_roof_edge_gutter_corner_reference_v1", "matriva_modern_2023_house_a05_canonical_render"], "Rens tagrender guide candidate generated from current House A references; human approval pending.", guide01DerivedProvenance),
  guide("gasset_gutter_g04_correct_result_v1", "rens_tagrender_correct_result_v1", "guides/rens-tagrender/g04-correct-result-v1.png", "correct_result", "Ren sort tagrende med fri vandvej og korrekt nedløb ved House A.", ["house_a_roof_edge_gutter_corner_reference_v1", "matriva_modern_2023_house_a05_canonical_render"], "Rens tagrender guide candidate generated from current House A references; human approval pending.", guide01DerivedProvenance)
];

export const gutterGuidePlacements = [
  { id: "gva_rens_g01_orientation_v1", assetId: "gasset_gutter_g01_orientation_v1", placement: "cover", position: 0, caption: "Find tagrenden og nedløbet, før du begynder." },
  { id: "gva_rens_g02_remove_debris_v2", assetId: "gasset_gutter_g02_remove_debris_v2", placement: "step", position: 0, caption: "Fjern løst snavs uden at presse det ned i nedløbet." },
  { id: "gva_rens_g03_flow_downpipe_v1", assetId: "gasset_gutter_g03_flow_downpipe_v1", placement: "step", position: 1, caption: "Skyl forsigtigt og kontrollér vandets vej mod nedløbet." },
  { id: "gva_rens_g04_correct_result_v1", assetId: "gasset_gutter_g04_correct_result_v1", placement: "after", position: 0, caption: "Resultat: ren rende, synlig vandvej og frit nedløb." }
];

export const gutterGuideHotspots = [
  { id: "ghot_rens_g02_remove_debris_v2", guideVersionAssetId: "gva_rens_g02_remove_debris_v2", hotspotType: "tip", position: 0, x: 0.58, y: 0.48, title: "Blade og snavs", body: "Fjern løst materiale lidt ad gangen og læg det i en spand eller pose i stedet for at skubbe det mod nedløbet." },
  { id: "ghot_rens_g03_flow_v1", guideVersionAssetId: "gva_rens_g03_flow_downpipe_v1", hotspotType: "checkpoint", position: 0, x: 0.45, y: 0.42, title: "Kontrollér vandets vej", body: "Vandet skal bevæge sig mod nedløbet uden at stå stille eller løbe over kanten." },
  { id: "ghot_rens_g03_joint_v1", guideVersionAssetId: "gva_rens_g03_flow_downpipe_v1", hotspotType: "checkpoint", position: 1, x: 0.58, y: 0.46, title: "Kontrollér samlingen", body: "Se efter synlige dryp eller vand, der presser ud ved samlingen efter skylning." },
  { id: "ghot_rens_g03_downpipe_v1", guideVersionAssetId: "gva_rens_g03_flow_downpipe_v1", hotspotType: "checkpoint", position: 2, x: 0.72, y: 0.62, title: "Tjek nedløbet", body: "Vandet skal fortsætte frit i nedløbet uden tydelige blokeringer." }
];
