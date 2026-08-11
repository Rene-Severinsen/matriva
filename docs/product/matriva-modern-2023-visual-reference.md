# Matriva Modern 2023 – visuelt referenceunivers

Status: A01 godkendt visuel/materialemæssig reference · A02–A15 pilot/superseded/rejected for canonical use · Canonical House A-geometri er godkendt som den nuværende arkitektoniske source of truth

Profil: `matriva_modern_2023` · `hprof_matriva_modern_2023`

Dette dokument er den reproducerbare visuelle specifikation for Matriva Modern 2023. Det er ikke en BBR-regel: referenceåret 2023 beskriver huset selv og må ikke bruges til automatisk profilvalg, før House A/B/C-grænser er besluttet.

## Canonical House A geometry – godkendt source of truth

House A beskriver én fysisk, reproducerbar bygning, som alle nye fotorealistiske billeder skal afledes fra. Canonical-pakken er en deterministisk teknisk model – ikke AI-art og ikke en afledning af skjult geometri i A01.

**Status: `approved_current_source_of_truth`.** Godkendelsen er: **“Ja – dette er nu Matriva House A, for nu.”** Mål, planløsning, åbninger, tag- og site-valg er godkendte canonical designbeslutninger. De er ikke observerede fakta om A01 eller egentlige byggetegninger. Fremtidige ændringer skal først foretages i canonical-modellen og derefter regenerere alle afledte assets.

### Source-of-truth-hierarki

1. **A01 / `a01-exterior-entry-original-v1.png`** = visuel og materialemæssig source of truth. Den fastlægger kun de synlige kvaliteter: lyse varme mursten, mørkt tag, sorte vinduer/dør, tagrender/nedløb samt lys- og haveudtryk. Den fastlægger ikke skjult geometri.
2. **`house-a-canonical-geometry.json`** = arkitektonisk og geometrisk source of truth: footprint, garage, tag, facader, åbninger og faste koordinater.
3. **`08-room-and-interior-visibility-map.svg`** = interiør source of truth: hvilket rum der ligger bag hver åbning og hvilke elementer der realistisk må være synlige.
4. **`09-site-plan.svg`** = landskabs-/spatial source of truth: indkørsel, hovedsti, terrasse, hæk, bede og træpositioner.
5. **Fremtidige fotorealistiske billeder** = afledte repræsentationer. De kan aldrig ændre en højere source of truth.

Et billede, en prompt eller en redigering må aldrig ændre disse data. En modstrid afvises; den afledte repræsentation rettes eller forkastes. Geometrien ændres kun ved en eksplicit godkendt ændring af JSON-kilden efter human approval.

### Reproducerbar pakke

Kilden ligger i `docs/product/house-a-canonical-geometry.json`; SVG’erne under `docs/product/house-a-canonical-geometry/` er genererede, versionsstyrede tekniske artefakter:

- `01-dimensioned-floor-plan.svg`
- `02-roof-plan.svg`
- `03-front-elevation.svg` til `06-right-elevation.svg`
- `07-opening-schedule.svg`
- `08-room-and-interior-visibility-map.svg`
- `09-site-plan.svg`
- `10-materials-and-immutable-rules.svg`
- `11-technical-referenceboard.svg`

Regenerér kun fra kilden:

```bash
npm run generate:house-a-geometry
npm run test:house-a-geometry
```

Generatoren validerer footprint, garage, tagets udhæng/kip, åbninger, rumrelationer, nedløb og site containment. Testen regenererer pakken to gange i midlertidige mapper og kræver byte-identiske SVG-filer. Det gør målændringer synlige, reproducerbare og mulige at reviewe som en almindelig kodeændring.

### Immutable geometry rules

Følgende er låst i den godkendte canonical-model og skal krydstjekkes på alle fremtidige views:

- Ét rektangulært footprint: 16,400 mm × 12,000 mm.
- Én integreret front-vest-garage: 5,800 mm × 7,200 mm.
- Ét 25° valmtag over hele footprintet med 450 mm udhæng, øst-vest-kip og fire faste nedløb; ingen skjulte kviste, ovenlys, skorsten eller taggennemføringer.
- Hver ydre åbning har stabilt ID, facade, offset, størrelse, brystning og rum bagved.
- Indkørsel, hovedsti, terrasse, perimeterhæk, to bede og to træer har faste koordinater; sæson og plantefylde må variere uden at flytte de permanente elementer.

Den fulde, maskinlæsbare regelmængde findes som `immutableGeometryRules` i JSON-filen og er visualiseret i `10-materials-and-immutable-rules.svg`.

### Render-valideringsregler efter godkendelse

Canonical-pakken er nu godkendt, så A02 FRONT og A03 REAR/GARDEN må fremstilles som kontrollerede pilot-renderinger. A04–A15 og nye guidebilleder er fortsat uden for den aktuelle approval gate.

Efter godkendelse skal hvert fotorealistisk view valideres mod JSON og SVG’er før det kan bruges:

1. **Footprint og garage:** samme bygningsvolumen og front-vest-garage; ingen ekstra vinger eller forskudte garager.
2. **Tag:** samme 25° valmtag, kipretning, udhæng, tagrende og nedløbslogik. Front, bag, venstre, højre og top skal kunne forklares af den samme konstruktion.
3. **Åbninger:** kun de schedulede åbninger med korrekt facade, rækkefølge og omtrentlige proportioner. Ingen ekstra panoramavinduer, døre eller flyttede vinduer.
4. **Interiør:** hvert kig gennem glas skal følge room/visibility-mappet. Køkken/alrum og stue må ikke få ens gentagne borde/stole; huset må ikke læse som forsamlingshus, restaurant, hotel eller showroom.
5. **Site:** terrasse, sti, indkørsel, hæk, bede og træer skal være i deres canonical relation til huset. Plantning skal være varieret, ikke en gentaget række af ens runde buske.
6. **Materiale:** A01’s lyse mursten, mørke tag, sorte rammer/dør og sorte afvanding bevares som visuel/materialemæssig reference. Produktnavne, vægopbygninger og uobserverede byggedetaljer må ikke opfindes.

Hvis en render fejler ét punkt, er resultatet **REJECT**. Den må ikke bruges til at “rette” kildegeometrien; renderen skal regenereres eller redigeres mod den godkendte model.

### Canonical camera- og render-pipeline

Kamerasystemet ligger i `house-a-canonical-camera-system.json`. De fem låste kameraer er `CAM_FRONT_HERO`, `CAM_FRONT`, `CAM_REAR`, `CAM_LEFT` og `CAM_RIGHT`; de deler 16:9-format, rectilinear perspective og samme millimeterbaserede koordinatsystem som geometrimodellen. A02 må kun bruge `CAM_FRONT`, og A03 må kun bruge `CAM_REAR`.

`npm run generate:house-a-previews` regenererer fem skematiske SVG/PNG-views direkte fra canonical geometri og kameraer. `npm run test:house-a-previews` kræver byte-identisk regeneration og validerer geometry- og camera-checksums. Disse previews er geometriske kontrolbilleder, ikke fotorealistiske assets.

Den fotorealistiske A02/A03-pilot er registreret i `house-a-photorealistic-pilot.json`. Hver render peger på præcis geometry-version, camera-ID, preview, A01-reference, opening-ID’er, fil-checksum og billeddimensioner. `npm run test:house-a-photorealistic-pilot` afviser manglende/ændrede kilder, forkerte kameraer, andre render-ID’er end A02/A03, forkerte opening-lister og ændrede billedfiler.

Maskinel validering dokumenterer input- og filintegritet; den kan ikke bevise, at AI-genererede pixels er geometrisk korrekte. Derfor skal referenceboardet og valideringsrapporten altid gennemgås ved en human approval gate. Indtil denne godkendelse er A02 og A03 `VALIDATED`, men ikke `APPROVED`.

### Superseded pilot-historik

De tidligere A02–A15-pilotbilleder blev skabt før den canonical geometri- og kamerapipeline. De forbliver historiske spor med status **SUPERSEDED / REJECTED FOR CANONICAL USE** og må hverken bruges som geometriinput eller overskrives af den nye pilot. Kun de nye, særskilt navngivne A02/A03 canonical drafts indgår i den aktuelle approval gate.

## Visuelle invariants

### Arkitektur

- Moderne dansk étplanshus, cirka 154 m² som reference.
- Afbalancerede, lave proportioner og mørkt valmtag med realistisk hældning.
- Samme facadeopdeling med integreret garage ved fronten og store terrassedøre mod bagsiden.
- Mørke, slanke vinduesrammer, sort hoveddør og mørk garageport.

### Materialer og udearealer

- Lyse, varme mursten; mørkt/sort tag; sorte tagrender og nedløb.
- Enkel moderne dansk have med græs, diskrete bede, flisearealer og terrasse.
- Ingen luksusoverdrivelse, overdrevne panoramavinduer, ekstra etager eller arkitektur, der ændrer husets identitet.

### Fotografi

- Realistisk boligfotografi med naturlige proportioner og materialer; aldrig CGI-look.
- Ingen tekst, pile eller indbrændte infobokse. Hotspots ligger oven på billedet i appen.
- Ingen mennesker, medmindre en guide kræver en konkret demonstration. En eventuel person må ikke ændre fokus fra huset eller opgaven.

### Vådrum

- Moderne, varmt neutralt badeværelse med store beige/stenfarvede fliser.
- Bruseniche med glasafskærmning og mørkt armatur.
- Mørkt vaskeskab, lyst rundt spejl og afdæmpet, realistisk belysning.
- Nye billeder skal bevare samme farve-, flise- og materialeverden. De må ikke antyde reparation af vådrumskonstruktionen.

## Historisk pilot-board (superseded)

Det historiske pilot-board i Matriva-konteksten dokumenterer disse motiver, men er ikke længere en source-of-truth for House A-geometri:

- Front/indgang, baghave/terrasse, venstre/højre side, baghus fra siden og bagsidens langside.
- Tagrendehjørne, tagrendens lige stræk, nedløb ved tag og fod.
- Vindue, yderdør, garageport samt taggennemføring/ventilation.
- Badeværelsesoverblik, bruseniche og synlige hårde fuger.

Boardet er bevaret som pilot-/QA-output – ikke som et godkendt master-board eller produktionsasset. Det indeholder tekst og collage-layout og kan derfor ikke bruges som guidebillede eller registreres som originalt `guide_asset`. Filnavnet `matriva-modern-2023-approved-master-references.html` er historisk og må ikke læses som aktuel godkendelsesstatus.

## Eksisterende separate original

Én tekstfri, separat exterior-original findes allerede i repoet og matcher House A:

- Planlagt key: `matriva_modern_2023_exterior_entry_master`
- Kilde: `apps/website/public/images/HeroImage.png`
- Dimensioner: 1672 × 941
- SHA-256: `1b4416fdbbf431107fb021e7be9b567a79537e1b0860bfdc4ec7998c4f990573`
- Motiv: indgangsside med lys murstensfacade, sort tag, tagrende, sort vindue/dør og det godkendte haveunivers.

`apps/mobile/assets/onboarding/welcome-hero_.png` har samme checksum og er derfor en kopi, ikke et selvstændigt master-asset. Originalen skal indlæses i guide-storage med checksum og produktionsmetadata, før den oprettes som `guide_asset`; den registreres ikke med en kunstig storage key imens.

## Planlagt referencebibliotek (ikke canonical-godkendt)

Når de separate, tekstfrie originalfiler findes, registreres de som `guide_assets` med den bekræftede `source_type` og metadata, der mindst indeholder `houseProfileKey`, `assetCategory`, `viewOrComponent`, `purpose`, `approvalStatus`, `generation`, `referenceAssetKeys` og QA-resultat. `ai_generated` bruges kun, når provenancen er bekræftet.

### Exterior master

- `matriva_modern_2023_exterior_front_master`
- `matriva_modern_2023_exterior_garden_terrace_master`
- `matriva_modern_2023_exterior_left_master`
- `matriva_modern_2023_exterior_right_master`
- `matriva_modern_2023_exterior_rear_master`
- `matriva_modern_2023_exterior_overview_master`

### Exterior components

- `matriva_modern_2023_gutter_corner_master`
- `matriva_modern_2023_gutter_straight_master`
- `matriva_modern_2023_downpipe_top_master`
- `matriva_modern_2023_downpipe_foot_master`
- `matriva_modern_2023_window_front_master`
- `matriva_modern_2023_front_door_master`
- `matriva_modern_2023_garage_door_master`
- `matriva_modern_2023_roof_ventilation_master`

### Interior master

- `matriva_modern_2023_bathroom_overview_master`
- `matriva_modern_2023_bathroom_shower_master`
- `matriva_modern_2023_bathroom_hard_joint_master`
- `matriva_modern_2023_bathroom_soft_joint_master` – mangler på det nuværende board og behøves kun, hvis den bruges i en guide.

## Guide-specifik billedplan

### Rens tagrender

1. Hero: husets tagrende synlig i en godkendt exterior-mastervinkel.
2. Problem: samme tagrende med realistiske blade og snavs.
3. Cleaning: sikker rensning; kun hånd/person hvis nødvendig og uden at flytte fokus.
4. Flow check: vandets vej mod nedløbet.
5. Correct result: ren rende og frit nedløb.

Planlagte hotspots: Blade og snavs, Kontrollér faldet, Kontrollér samlingen, Tjek nedløbet. Koordinater fastlægges først på de godkendte slutbilleder.

### Tjek fuger i vådrum

1. Hero: badeværelse eller bruseniche.
2. Inspection: synlige fuger ved relevant overgang.
3. Problem – crack: mindre, realistisk synlig revne/skade.
4. Problem – discoloration: realistisk misfarvning/problemtegn.
5. Correct result: intakt synlig fuge.

Planlagte hotspots: Tjek hjørnefugen, Se efter revner, Kontrollér gulv/væg-overgangen, Se efter misfarvning. Billederne er til inspektion, aldrig til risikabel vådrumsreparation.

## Produktions- og QA-flow

```text
Godkendt visuel/materialemæssig reference
  → guide-specifikation
  → generation eller edit med reference-assets
  → visuel QA
  → godkendt guide_asset i storage
  → guide_version_assets
  → hotspots efter billedgodkendelse
```

AI er udelukkende et internt produktionsværktøj. Normal visning læser færdiggodkendte filer fra storage uden AI-kald.

Et billede godkendes kun, hvis det:

- tydeligt bevarer Matriva Modern 2023-identiteten;
- har fysisk plausibel vedligeholdelse og ingen artefakter;
- er realistisk fotografisk uden tekst eller indbrændte infobokse;
- illustrerer netop guidepunktet og efterlader plads til hotspots.

Et mislykket identitetsmatch afvises og regenereres/redigeres.

## Pilotoutput: House A og Rens tagrender

Pilotens originale filer ligger under `apps/api/assets/guides/matriva-modern-2023/masters/`. A01 er den eneste aktuelle godkendte visuelle/materialemæssige reference. A02–A15 er bevaret som pilot-/QA-/regressionsmateriale, men er superseded og rejected for canonical use, fordi de ikke beskriver samme fysiske hus. `matriva-modern-2023-approved-master-references.html` og `approved-master-references-v1.png` er historiske, superseded boards. Den eksisterende website-original er kopieret ind som A01 uden at ændre den oprindelige website-fil.

Første guidebilleder til `Rens tagrender` ligger under `apps/api/assets/guides/matriva-modern-2023/guides/rens-tagrender/`. Pilotens G01-preview genbruger A06-pilotmateriale; G02–G05 er guide-specifikke pilotoriginaler. De er ikke den endelige visuelle guide-standard. Det statiske produktpreview findes i `rens-tagrender-visual-preview.html` og er ikke app-UI.

Asset-importen er en kontrolleret, idempotent produktionshandling:

```bash
node tools/ingest-guide-visual-assets.mjs
node tools/test-guide-visual-assets.mjs
```

Importen skriver de faktiske originalfiler til den eksisterende lokale DEV-storage-adapter og registrerer checksum, provenance, House A-metadata, guideplaceringer og fire hotspots i 0026-modellen. Den opretter ikke generiske varianter i `guide_asset_profile_variants`, fordi alle pilotfiler er House A-specifikke og der endnu ikke findes et generisk base-asset, som skal varieres.

Når originalerne foreligger, bruges den eksisterende 0026-model:

- Original: `guide_assets` med storage key, checksum og produktionsmetadata.
- Guideplacering: `guide_version_assets`.
- House A-variant: `guide_asset_profile_variants` ved behov.
- Interaktiv forklaring: `guide_hotspots` efter finalisering af billede og koordinater.
