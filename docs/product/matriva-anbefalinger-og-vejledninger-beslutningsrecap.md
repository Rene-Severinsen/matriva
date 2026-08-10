# Matriva: beslutningsrecap for anbefalinger og vejledninger

Dette dokument samler beslutningspunkterne fra samtalen om Matrivas anbefalinger, vejledningsunivers, billedunivers, BBR-personalisering, produktion og det fremtidige håndværkerspor.

## 1. Produktretning

Matriva skal ikke kun fortælle boligejeren, **hvad** der bør vedligeholdes. Produktet skal også forklare **hvordan** opgaven kan udføres på en tryg og praktisk måde.

En anbefaling skal derfor kunne føre til en kvalitetssikret vejledning med:

- hvorfor opgaven er relevant
- sværhedsgrad og forventet tidsforbrug
- værktøj og materialer
- trin-for-trin-instruktioner
- sikkerhedsforhold
- typiske fejl
- hvornår en fagperson bør kontaktes
- billeder, illustrationer og eventuelle interaktive kontrolpunkter
- en printvenlig version

Matriva skal opleves som en digital husejerassistent og et praktisk vidensunivers, ikke blot som en liste med huskelister.

## 2. Vejledninger er et selvstændigt bibliotek

Vejledninger skal være selvstændige indholdsobjekter, som kan nås ad flere veje:

1. Matriva anbefaler en opgave.
2. Brugeren opretter selv en opgave.
3. Brugeren søger eller browser i vejledningsbiblioteket og tilføjer vejledningen som opgave.

Alle tre veje skal ende i den samme bruger-ejede opgavemodel.

Biblioteket skal kunne søges og browses efter eksempelvis:

- titel og alternative søgeord
- kategori og husdel
- problemtype og materialer
- sværhedsgrad og tidsforbrug
- sæson
- BBR-relevans
- vejledningstekst

Søgningen skal kunne håndtere almindelige formuleringer og synonymer. En søgning som “vand løber over taget” skal eksempelvis kunne finde “Rens tagrender”.

## 3. Koblingen mellem guide, skabelon og konkret opgave

Der skal være en klar adskillelse mellem redaktionelt indhold, standardmetadata og brugerens konkrete plan:

```text
Guide Template
    ↓
Maintenance Task Template
    ↓
House Maintenance Task
```

### Guide Template

Indeholder tekst, billeder, hotspots, sikkerhedsoplysninger, printversion og versionshistorik.

### Maintenance Task Template

Indeholder standardtitel, kategori, anbefalet interval, sæson, tidsforbrug, relevansregler og reference til guiden.

### House Maintenance Task

Indeholder brugerens konkrete hus, dato, status, eventuelle egne noter, historik og brugerens valgte gentagelse.

Når en bruger tilføjer en vejledning som opgave, skal Matriva forudfylde relevante metadata, men brugeren skal kunne ændre dato, interval, sæsonvalg, påmindelse, noter og om opgaven er engangs- eller tilbagevendende.

En senere ændring af en standardskabelon må ikke uventet ændre brugerens allerede oprettede opgave.

Eksempel: “Rens tagrender” kan foreslå to gange årligt i april og oktober, mens en bruger kan vælge en konkret dato, hver sjette måned og en påmindelse syv dage før. Personlige forhold kan senere begrunde et kortere interval.

## 4. Vejledningernes faste opbygning

Den anbefalede grundstruktur er:

1. Kort introduktion og formål.
2. Hvorfor opgaven er vigtig.
3. Sværhedsgrad, tidsforbrug og bedste tidspunkt.
4. Værktøj og materialer.
5. Før du går i gang.
6. Trin-for-trin.
7. Typiske fejl.
8. Kontrol af korrekt resultat.
9. Hvornår en fagperson bør kontaktes.
10. Printvenlig/PDF-version.

Et fast afsluttende afsnit, “Sådan ser det ud, når det er gjort korrekt”, skal bruges, hvor det giver mening. Før/efter-billeder og tydelige eksempler øger boligejerens tryghed og kvaliteten af det udførte arbejde.

“Rens tagrender” er et eksempel på den ønskede detaljeringsgrad: sikker stige, fjernelse af blade og mos, skylning, kontrol af nedløb, kontrol for revner/rust/løse beslag og tydelig grænse for, hvornår en tag- eller blikkenslager bør kontaktes.

## 5. Matriva-huset og det visuelle univers

Matriva skal bruge Matriva-huset som gennemgående reference i vejledningerne. Det skaber genkendelighed, en samlet visuel identitet og en mere professionel oplevelse end tilfældige huse fra billede til billede.

Matriva-huset skal kunne bruges til at vise både ude- og indeområder, eksempelvis:

- facade, gavl, bagside, tag og tagrender
- vinduer, døre, terrasse, carport, skur og udendørs hane
- badeværelse, bryggers, køkken og loft
- teknikskab, ventilation, varmepumpe/fjernvarmeunit og el-tavle
- kælder, afløb, regnvandsbrønd og øvrige relevante husdele

Der skal opbygges en **Matriva House Library** med faste referencepakker, kamerastil, materialer, farver, lys og billedformater.

Version 1 bør bruge ét kontrolleret referencehus, House A, baseret på det moderne Matriva-hus. Senere kan biblioteket udvides med eksempelvis:

- House B: klassisk parcelhus fra cirka 1970-1999
- House C: ældre villa/murermestervilla før cirka 1970
- eventuelt House D: trævilla eller sommerhus

De samme guides skal på sigt kunne genbruges med variantbilleder til de øvrige hustyper.

## 6. BBR og personalisering

Når et hus oprettes, skal BBR-data kunne bruges til at tilpasse anbefalinger og billed-/guidevarianter, men med tydelig usikkerhed. BBR må ikke behandles som et komplet eller fejlfrit billede af boligen.

Byggeår er et centralt signal til valg af House Profile. En første regel kan eksempelvis mappe ældre huse til House C, huse fra 1970-1999 til House B og nyere huse til House A. Senere kan reglerne udvides med tagmateriale, ydervæg, varmeform, skorsten, kælder, etager, garage, carport, udhus, arealer og energiforsyning.

BBR-baserede regler skal være en regelmotor, der kan versioneres, testes og udvides uden at gøre al logik hårdkodet. På længere sigt kan geografi, vejr, træer, kystnærhed, radon, oversvømmelse og jordtype indgå, hvis datagrundlag og produktværdi kan dokumenteres.

Brugeroplevelsen skal ikke kalde resultatet “AI-anbefalinger”. Den skal kommunikere, at Matriva har analyseret huset og fundet anbefalinger, der passer til netop boligen.

## 7. Async generering af personlige anbefalinger

Husoprettelsen skal være hurtig og må ikke vente på en komplet analyse.

### Ved oprettelse

- Huset gemmes.
- De mest generiske anbefalinger oprettes straks.
- Brugeren kan begynde at bruge appen med det samme.

Eksempler kan være røgalarmer, tagrender, ventilation, udendørs træværk og generelle sikkerhedskontroller.

### Efter oprettelse

En async analyse kører uden at blokere onboarding:

```text
House created
    ↓
Async analysis job
    ↓
BBR/public data + regelmotor
    ↓
Personlige House Recommendations
    ↓
Intern notifikation og eventuelt push
```

Analysen skal kunne finde og forklare nye anbefalinger, sæsonopgaver og husrelaterede forhold. Brugeren skal kunne se, at anbefalingerne er dannet fra husets data og ikke blot er en generisk liste.

Anbefalinger bør udspringe af genbrugelige templates, mens den konkrete House Recommendation gemmer hus, template, begrundelse, timing, recurrence, kilde og provenance.

## 8. Billeder, hotspots og interaktive vejledninger

Den ønskede guideoplevelse er en kombination af:

- oversigtsbillede af Matriva-huset
- illustration med markører eller infobokse
- nærbillede af det, der skal kontrolleres
- før/efter-eksempel
- billede af korrekt resultat

De små infobokse er et muligt kendetegn for Matriva. I appen skal de være klikbare hotspots, så brugeren kan trykke på en markør og få en kort forklaring, et ekstra billede eller senere en animation.

Hotspots må ikke brændes ind i selve baggrundsbilledet. Baggrundsbillede, koordinater og tekst skal gemmes separat, eksempelvis med normaliserede `x`- og `y`-koordinater. Hotspotdata skal kunne rumme titel, forklaring, rækkefølge og type som tip, advarsel, kontrolpunkt eller korrekt resultat.

Det giver responsiv visning, redigering i Admin, bedre tilgængelighed, senere oversættelse og mulighed for at genbruge data i printversionen.

På kort sigt accepteres AI-skabte billeder som en måde at få det første univers på plads. På længere sigt bør realistiske fotografier fra virkelige huse gradvist erstatte AI-billeder, især hvor brugeren skal identificere råd, rust, frostskader, slid eller andre fagligt vigtige forhold.

## 9. Initial kontrolleret masseproduktion med Codex/AI

Codex/AI kan bruges som intern produktionsagent og pipeline-orkestrator. Det skal være et redaktionelt produktionssystem, ikke et ukontrolleret script, der masseproducerer og publicerer direkte.

Første batch bør være cirka 20-25 prioriterede vejledninger. Med cirka 3-4 billeder pr. guide svarer det til omkring 75-100 billeder. Det er nok til at teste kvalitet, konsistens, proces og økonomi uden at skabe et stort oprydningsprojekt.

Den kontrollerede pipeline er:

```text
Opgaveskabelon
    ↓
Guide- og tekstudkast
    ↓
Billedplan med Matriva-reference
    ↓
Billedproduktion
    ↓
Hotspots og metadata
    ↓
Kladder i Admin
    ↓
Automatisk QA + faglig gennemgang
    ↓
Rettelse
    ↓
Publicering
```

Codex kan hjælpe med struktur, beskrivelser, prompts, metadata, hotspot-koordinater, PDF-opbygning og QA-rapportering. Output skal have versionshistorik og sporbarhed, så en guide kan forbedres eller regenereres senere.

Det langsigtede mål er ikke kun 25 guides, men en produktionsfabrik, der kan producere 250 eller flere guides med samme kvalitet og visuelle system.

## 10. Admin-vedligehold og faglig validering

Admin skal kunne vedligeholde guide og opgaveskabelon samlet. Minimumsområderne er:

- titel, introduktion og brødtekst
- værktøj, tidsforbrug, sværhedsgrad og sikkerhed
- trin, billeder, billedtekster og rækkefølge
- cover-billede og hotspots
- søgeord, synonymer, kategori og husdel
- standardgentagelse og sæson
- BBR-/relevansregler
- PDF/printversion
- kladde, publiceret og afpubliceret status
- versionering

Admin skal kunne uploade flere billeder, vælge cover, ændre rækkefølge, skrive billedtekst, beskære og udskifte indhold. Ændringer skal kunne ske uden at ændre historikken for allerede udførte opgaver.

Automatisk QA kan kontrollere manglende felter, struktur, koordinater, billeddimensioner, dubletter, forbudte formuleringer og sammenhæng mellem guide og opgavemetadata.

Fagfolk skal være redaktører og godkende:

- teknisk korrekthed
- sikkerhed og risikogrænser
- om billederne viser det rigtige
- om Matriva-huset er visuelt konsistent
- om en opgave er egnet til gør-det-selv
- om en fagperson bør anbefales
- om teksten kan skabe ansvar, misforståelser eller skade

AI er forfatter og produktionshjælp; fagfolk har den endelige faglige validering før publicering.

## 11. Print og PDF

Alle vejledninger skal have en printvenlig version, som kan sendes fra appen til print eller downloades som en pæn PDF.

Printversionen skal kunne bruges i haven, gives videre til et familiemedlem eller en håndværker og arkiveres. Den skal bygge på samme strukturerede guide- og hotspotdata, men tilpasses papirformatet, så interaktion ikke er en forudsætning for at forstå vejledningen.

## 12. Økonomiprincippet: ingen AI-runtime-afhængighed

Den grundlæggende arkitekturregel er:

> AI er et internt produktionsværktøj for Matriva – ikke en runtime-afhængighed for brugerne.

AI må gerne bruges ved produktion af nye guides, billeder, hotspots, PDF’er, oversættelser og forslag til BBR-regler. Det skal ske lejlighedsvist, eksempelvis i batches, og resultatet skal gemmes som færdigt, kvalitetssikret indhold.

Når en bruger åbner en guide, skal appen læse tekst, billeder, hotspots og metadata fra Matrivas egen backend/databaserede indhold. Den almindelige brugerrejse må ikke kræve et løbende abonnement på en AI-motor eller et AI-kald pr. visning.

Dette holder driftsomkostningerne lave og gør Matrivas eget, kvalitetssikrede vidensbibliotek til det varige aktiv.

En fremtidig “Spørg Matriva”-funktion eller billedbaseret assistent kan vurderes som en separat premiumfunktion, når økonomien og værdien er dokumenteret. Den er ikke en forudsætning for basisproduktet.

## 13. Fremtidigt håndværker- og henvisningsspor

Håndværkerflowet skal ligge i produktarkitekturen som en senere mulighed, men være uden for det første guide-scope.

Den naturlige brugerrejse er:

```text
Matriva opdager → Matriva forklarer → brugeren vælger selv eller får hjælp
```

Når en guide viser, at arbejdet bør udføres af en fagperson, kan brugeren senere få valgene “Opret opgave” eller “Få hjælp af en fagperson”.

Første version bør være et samarbejde med en eksisterende portal eller partner frem for at bygge en egen markedsplads. Matriva kan sende opgavetype, postnummer, relevant guide og eventuelt brugerens samtykkede kontekst videre. Partneren håndterer håndværkere, tilbud, betaling, tvister og den tunge markedspladsdrift.

Mulige forretningsmodeller kan udvikles fra affiliate-/henvisningsbetaling til lead fee eller egentlige partnerskaber, hvis efterspørgslen dokumenterer høj købsintention.

Matriva skal forblive uvildig. Guides må ikke skræmme brugeren over til en håndværker; grænsen mellem gør-det-selv og fagperson skal være fagligt begrundet. Håndværkersporet bør først aktiveres, når det kvalitetssikrede guidebibliotek og anbefalingsmotoren fungerer, eksempelvis efter de første 20-25 validerede guides.

## 14. Samlet prioritering

1. Etabler det redaktionelle guide- og asset-system.
2. Producer og fagligt valider 20-25 kern guides med ét Matriva-referencehus.
3. Understøt søgning, browse og “Tilføj som opgave” med fælles opgavemodel.
4. Implementer print/PDF, hotspots, Admin-versionering og QA.
5. Brug BBR-data og async analyse til personlige anbefalinger med generiske anbefalinger som fallback.
6. Hold AI ude af runtime og brug den kun kontrolleret til produktion.
7. Test senere henvisning til fagpersoner gennem samarbejdspartnere.

Den vigtigste samlede beslutning er at bygge et kvalitetssikret, versioneret Matriva-vidensbibliotek, hvor AI accelererer produktionen, men hvor faglig validering, Matrivas egne assets og en lav driftsøkonomi er grundlaget for produktet.
