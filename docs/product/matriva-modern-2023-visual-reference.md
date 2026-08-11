# Matriva Modern 2023 – visuelt referenceunivers

Status: A01 godkendt visuel/materialemæssig reference · A02–A15 pilot/superseded/rejected for canonical use

Profil: `matriva_modern_2023` · `hprof_matriva_modern_2023`

Dette dokument er den reproducerbare visuelle specifikation for Matriva Modern 2023. Det er ikke en BBR-regel: referenceåret 2023 beskriver huset selv og må ikke bruges til automatisk profilvalg, før House A/B/C-grænser er besluttet.

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
