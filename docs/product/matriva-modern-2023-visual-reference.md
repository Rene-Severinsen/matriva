# Matriva Modern 2023 – visuelt referenceunivers

Status: A01–A05 er `HUMAN_APPROVED` den 2026-08-12 og promoveret til `CURRENT_CANONICAL_REFERENCE` · canonical geometri er uændret · facade, garden character, house consistency, A02 single-handle correction og A05 drainage-v2 er godkendt · masonry-sporet og den gamle A02–A15-pilot er superseded/rejected for canonical use

Profil: `matriva_modern_2023` · `hprof_matriva_modern_2023`

Dette dokument er den reproducerbare visuelle specifikation for Matriva Modern 2023. Det er ikke en BBR-regel: referenceåret 2023 beskriver huset selv og må ikke bruges til automatisk profilvalg, før House A/B/C-grænser er besluttet.

## Canonical House A geometry – godkendt source of truth

House A beskriver én fysisk, reproducerbar bygning, som alle nye fotorealistiske billeder skal afledes fra. Canonical-pakken er en deterministisk teknisk model – ikke AI-art og ikke en afledning af skjult geometri i A01.

**Status: `approved_current_source_of_truth`.** Godkendelsen er: **“Ja – dette er nu Matriva House A, for nu.”** Mål, planløsning, åbninger, tag- og site-valg er godkendte canonical designbeslutninger. De er ikke observerede fakta om A01 eller egentlige byggetegninger. Fremtidige ændringer skal først foretages i canonical-modellen og derefter regenerere alle afledte assets.

### Source-of-truth-hierarki

1. **`house-a-canonical-geometry.json`** = arkitektonisk og geometrisk source of truth: footprint, garage, tag, facader, åbninger og faste koordinater. Filen og dens godkendte hash ændres ikke af materialebeslutningen.
2. **`house-a-canonical-material-specification.json`** = materialemæssig source of truth for alle udvendige facadeflader: ét sammenhængende lyst, varmt-neutralt, mat og diskret mineralsk pudset facadesystem. Denne specifikation superseder kun geometripakkens historiske facadeværdi `light warm brick`.
3. **`house-a-canonical-landscape-specification.json`** = garden-character source of truth: naturlig moderne dansk bolighave, varierede stauder/blomster/prydgræsser, væsentligt færre kuglebuske og små registrerede træer. Den ændrer ikke site-planens spatialstruktur.
4. **`08-room-and-interior-visibility-map.svg`** = interiør source of truth: hvilket rum der ligger bag hver åbning og hvilke elementer der realistisk må være synlige.
5. **`09-site-plan.svg`** = landskabs-/spatial source of truth: indkørsel, hovedsti, terrasse, hæk, bede og træpositioner.
6. **`house-a-canonical-render-manifest.json` og de human-approved canonical A01–A05-filer** = current photorealistic reference for facade-look, lys/stemning, mørkt tag, sorte openings/afvanding, natural-garden character og samlet House A-udtryk. De er afledte repræsentationer og kan aldrig ændre en højere source of truth.
7. **A01-originalen** = `HISTORICAL VISUAL REFERENCE`; dens exposed-brick-materiale er `SUPERSEDED`.

Et billede, en prompt eller en redigering må aldrig ændre disse data. En modstrid afvises; den afledte repræsentation rettes eller forkastes. `CURRENT_CANONICAL_REFERENCE` betyder den godkendte nuværende version, ikke immutable forever. Fremtidige ændringer skal være eksplicitte, versionsstyrede, dokumenterede, provenance-bevarende og validerede samt kræve ny human approval, når canonical reference ændres.

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

Canonical-pakken og den samlede A01–A05 approval gate er godkendt. De stabile filer og deres checksums ligger i `house-a-canonical-render-manifest.json`. A06–A15 og nye guidebilleder er fortsat uden for scope.

Efter godkendelse skal hvert fotorealistisk view valideres mod JSON og SVG’er før det kan bruges:

1. **Footprint og garage:** samme bygningsvolumen og front-vest-garage; ingen ekstra vinger eller forskudte garager.
2. **Tag:** samme 25° valmtag, kipretning, udhæng, tagrende og nedløbslogik. Front, bag, venstre, højre og top skal kunne forklares af den samme konstruktion.
3. **Åbninger:** kun de schedulede åbninger med korrekt facade, rækkefølge og omtrentlige proportioner. Ingen ekstra panoramavinduer, døre eller flyttede vinduer.
4. **Interiør:** hvert kig gennem glas skal følge room/visibility-mappet. Køkken/alrum og stue må ikke få ens gentagne borde/stole; huset må ikke læse som forsamlingshus, restaurant, hotel eller showroom.
5. **Site:** terrasse, sti, indkørsel, hæk, bede og træer skal være i deres canonical relation til huset. Plantning skal være varieret, ikke en gentaget række af ens runde buske.
6. **Materiale:** Alle udvendige facadeflader skal vise samme lyse, varmt-neutrale, matte og diskret mineralske pudsede facadesystem. Mørkt tag, sorte rammer/dør og sort afvanding følger fortsat A01. Synlige mursten, fuger, grids, blokke, paneler eller uautoriserede facadeinddelinger medfører `REJECT`.

Hvis en render fejler ét punkt, er resultatet **REJECT**. Den må ikke bruges til at “rette” kildegeometrien; renderen skal regenereres eller redigeres mod den godkendte model.

### Canonical camera- og render-pipeline

Kamerasystemet ligger i `house-a-canonical-camera-system.json`. De fem låste kameraer er `CAM_FRONT_HERO`, `CAM_FRONT`, `CAM_REAR`, `CAM_LEFT` og `CAM_RIGHT`; de deler 16:9-format, rectilinear perspective og samme millimeterbaserede koordinatsystem som geometrimodellen. A02 må kun bruge `CAM_FRONT`, A03 `CAM_REAR`, A04 `CAM_LEFT` og A05 `CAM_RIGHT`. Ingen kameraværdier blev ændret til A04/A05.

`npm run generate:house-a-previews` regenererer fem skematiske SVG/PNG-views direkte fra canonical geometri og kameraer. `npm run test:house-a-previews` kræver byte-identisk regeneration og validerer geometry- og camera-checksums. Disse previews er geometriske kontrolbilleder, ikke fotorealistiske assets.

Den fotorealistiske A02–A05-serie er registreret i `house-a-photorealistic-pilot.json`. Hver render peger på præcis geometry-version, camera-ID, preview, A01-reference, opening-ID’er, fil-checksum og billeddimensioner. `npm run test:house-a-photorealistic-pilot` afviser manglende/ændrede kilder, forkerte kameraer, andre render-ID’er end A02–A05, forkerte opening-lister og ændrede billedfiler.

Maskinel validering dokumenterer input- og filintegritet; den kan ikke alene bevise, at AI-redigerede pixels er geometrisk korrekte. `house-a-rendered-facade-natural-garden-drainage-approval-board.png` er derfor bevaret og checksum-låst som det board, der blev human-approved den 2026-08-12. A02 single-handle-v3 og A05 drainage-v2 er godkendt. `house-a-current-canonical-referenceboard-v1.png` er et efterfølgende deterministisk referenceboard afledt fra de promoverede assets; det erstatter ikke approval-recordet.

### Canonical material decision – lys pudset facade

Den eksplicitte human design decision er: **Matriva House A skal have en lys pudset facade.** Den maskinlæsbare specifikation ligger i `house-a-canonical-material-specification.json`. Alle House A's udvendige facadeflader skal fremstå som samme sammenhængende lyse pudsede facadesystem. Variation må kun skyldes perspektiv, naturligt lys, skygge, vejrlig/ambient occlusion og mindre realistisk overfladevariation.

Det konkrete photorealistic facade-look i `a01-rendered-facade-test-v1.png` er human-approved og har bestået den beskyttede-element-validering i `house-a-a01-rendered-facade-validation.md`. Det er nu reference for A01–A05's facade-tone, pudsstruktur og roughness-look. Den efterfølgende garden refinement må ikke ændre dette facade-look.

### Canonical garden character – naturlig moderne dansk bolighave

Den spatialt bindende site-plan er uændret. `house-a-canonical-landscape-specification.json` skelner mellem immutable site structure—hus, indkørsel, hovedsti, terrasse, perimeterhæk, `BED_01`, `BED_02`, `TREE_01` og `TREE_02`—og fleksibel plantning som stauder, blomstring, mindre buske, prydgræsser og sæsonvariation.

Der må ikke forekomme gentagne rækker eller klynger af næsten identiske runde buske. Som bred visuel kompositionsregel må højst 2–3 tydeligt runde/kompakte buske dominere ét exterior-view. Beplantningen skal variere naturligt i højde, bredde, vækstform og bladstruktur med rolige blomster, stauder og prydgræsser. `TREE_01` og `TREE_02` forbliver på deres canonical koordinater og må læses som små åbne løv-/frugttræer i boligskala, visuelt højst cirka 3 meter.

A01 natural-garden-versionen blev human-approved uden at tilføje et nyt permanent træ. Ingen nye permanente frugt-/æbletræer er canonical i den aktuelle A01–A05-v1-serie; en senere tilføjelse kræver en eksplicit versionsstyret ændring. A01–A05-output, source-checksums, camera-ID'er, material-/landscape-versioner og beskyttede elementer er registreret i `house-a-rendered-facade-natural-garden-provenance.json` og `house-a-canonical-render-manifest.json`.

### A01–A05 rollout og A05 drainage

Alle fem canonical renders viser samme pudsede facadefamilie og naturlige plantekarakter uden synligt murværk. A05 blev først konverteret med drainage-fejlen bevaret, og første særskilte drainage-forsøg blev afvist, fordi højre rør forblev inset. Den human-approved v2 bevarer venstre rør og placerer højre rør ved højre hushjørne efter samme fysiske princip; tagrenden følger tagfoden.

### Lukket masonry-spor

Alle masonry correction drafts og den deterministiske masonry-test er `REJECTED / SUPERSEDED` og bevares kun som historisk QA-evidens. Det oprindelige AI-murværk havde stacked/grid-fuger; precise-object-edit rettede det ikke stabilt; den deterministiske texture-projection skabte geometrisk forskudt forbandt, men facaden fremstod flad, skæv og kunstig. Ingen af disse artefakter må indgå som aktiv House A render-input eller canonical source of truth.

En fremtidig guide om murværksfuger kan bruge et separat, kontrolleret detailmotiv med korrekt mursten og mørtelfuge. Det motiv er ikke House A og ligger uden for denne opgave.

### Superseded pilot-historik

De tidligere A02–A15-pilotbilleder blev skabt før den canonical geometri- og kamerapipeline. De forbliver historiske spor med status **SUPERSEDED / REJECTED FOR CANONICAL USE** og må hverken bruges som geometriinput eller overskrives af den nye serie. De tidligere A02–A05 drafts og candidates bevares som provenance; kun filerne registreret i `house-a-canonical-render-manifest.json` er current canonical photorealistic reference.

### A04/A05 side-view gate

A04 LEFT er afledt fra `CAM_LEFT` og må vise præcis `LEFT_WINDOW_01` og `LEFT_GARAGE_DOOR_01`. Kameraets skærmretning vender facade-offsettet, så den synlige rækkefølge er master-vindue → garage-sidedør. A05 RIGHT er afledt fra `CAM_RIGHT` og viser `RIGHT_WINDOW_01` → `RIGHT_WINDOW_02`: et mindre bedroom-2-vindue efterfulgt af et bredere living-room-vindue, uden dør.

A04 bevarer det rektangulære footprint, den trekantede sideprojektion af det fælles valmtag, kontinuerlig sort tagrende og facadehjørne-nedløb. A05 drainage-v2 bevarer volume/openings og det korrekte venstre nedløb, mens højre nedløb er korrigeret ved det fysiske højre hushjørne. Begge er human-approved. Pre-correction-observationen bevares i `house-a-a04-a05-validation.md` som historik.

Begrænsning: De centrerede sidekameraer gør sidefacadernes openings matematisk læsbare, men skjuler hovedparten af garage- og terrasseplanen bag hushjørnerne. Disse elementers kontinuitet valideres derfor mod canonical plan/site samt de godkendte A02/A03-views, ikke ved at opfinde et obliqt sidekamera.

## Visuelle invariants

### Arkitektur

- Moderne dansk étplanshus, cirka 154 m² som reference.
- Afbalancerede, lave proportioner og mørkt valmtag med realistisk hældning.
- Samme facadeopdeling med integreret garage ved fronten og store terrassedøre mod bagsiden.
- Mørke, slanke vinduesrammer, sort hoveddør og mørk garageport.

### Materialer og udearealer

- Lys, varmt-neutral, mat og diskret mineralsk pudset facade uden synlige mursten, fuger, grids eller paneler; mørkt/sort tag; sorte tagrender og nedløb.
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
- Motiv: indgangsside med historisk lys murstensfacade, sort tag, tagrende, sort vindue/dør og det godkendte haveunivers. Murstensfacaden er superseded; de øvrige fotografiske kvaliteter bevares som reference.

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

Pilotens originale filer ligger under `apps/api/assets/guides/matriva-modern-2023/masters/`. A01 er fortsat fotografisk reference, men dets murstensfacade er superseded af den canonical pudsede materialespecifikation. A02–A15 er bevaret som pilot-/QA-/regressionsmateriale, men er superseded og rejected for canonical use, fordi de ikke beskriver samme fysiske hus. `matriva-modern-2023-approved-master-references.html` og `approved-master-references-v1.png` er historiske, superseded boards. Den eksisterende website-original er kopieret ind som A01 uden at ændre den oprindelige website-fil.

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
