# Product Notes

Product scope is governed by `MATRIVA_SCOPE_V1.md`.

Do not add V1 modules outside the approved scope without a documented scope decision.

## Vedligeholdelse v1

Vedligeholdelse er husets aktive arbejdsplan og historik. Standardvisningen er
“Aktuelt”, mens Forår, Sommer, Efterår, Vinter og Alle er kompakte filtre.
Aktive opgaver grupperes backend-kompatibelt som overskredne, snart, denne
sæson og senere uden dubletter i samme visning.

Sæsonfiltre følger opgavens reelle timing. Konkrete deadlines klassificeres
efter måned: marts-maj er forår, juni-august er sommer, september-november er
efterår, og december-februar er vinter. Seasonal-window opgaver følger den
gemte sæson. Opgaver uden timing vises ikke i sæsonfiltre, og `all_year` vises
kun i Aktuelt, når den er relevant, samt i Alle.

Matriva-anbefalinger er separate fra aktive tasks. Et pending forslag bevarer
kilde, begrundelse, timing, recurrence og provenance. Når brugeren vælger
“Tilføj til vedligeholdelse”, opretter API’et én redigerbar brugerejet task med
relation tilbage til recommendation. Hvis forslaget ikke allerede har en konkret
deadline, skal brugeren vælge en dato i mobilappens native datovælger før
accept. “Afvis forslag” skjuler den aktuelle version.

Brugeroprettede opgaver er dato-drevne. Opret, rediger og flyt viser ikke
sæsonchips; de bruger konkret dato eller “ingen dato”. Sæsonen udledes fælles
fra datoen til filtrering, så brugerens plan ikke gemmer manuel sæson-timing.

Historikken viser de tre seneste udførte opgaver på hovedskærmen og bygger på
completion-records, ikke kun task-status. “Vis al historik” åbner en fuld
historikvisning med filtre for år og bygningsdel/kategori. Detailvisning viser
snapshotdata, note, pris, recurrence og provenance, når data findes.

Pris er valgfri vedligeholdelsesdata. Den kan angives ved oprettelse, redigeres
på aktive opgaver, vises kompakt på opgave og historik og gemmes i minor units
med `DKK` som valuta. Completion snapshotter den aktuelle pris, så senere
ændringer på en tilbagevendende successor ikke ændrer historikken.

Recurrence v1 understøtter kun de faste intervaller i API-kontrakten:
månedligt, hver 3. måned, hver 6. måned, årligt, hvert 2., 3., 5. og 10. år.
Næste forekomst beregnes fra udført dato.

Vedligeholdelse v1 har ingen dokumentationsflow, filrækker eller billeduploads.
Dokumenter håndteres under fanen Dokumenter, og husfoto håndteres på Mit hus.
Begge bruger fortsat backend-ejet privat object storage via Matriva API’et.
Hetzner S3-konfiguration ligger i API-miljøvariabler uden værdier i repoet, og
mobilappen modtager aldrig permanente credentials eller offentlige object URLs.
