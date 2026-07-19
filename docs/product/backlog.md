# Matriva Product Backlog

## Generiske Matriva-anbefalinger v1

Status: Implementeret.

- Backend-ejet og versionsstyret maintenance-katalog er synket idempotent til PostgreSQL.
- Relevante anbefalinger materialiseres som house- og periode-scopede instances.
- Accept opretter almindelige editable maintenance tasks med katalog-lineage og snapshot.
- Task completion og existing recurrence-flow er fortsat den eneste recurrence-mekanisme efter accept.
- Permanent skjulning er house-scoped per `catalogKey`.
- Mobilen viser højst tre anbefalinger på overblikket, har “Vis alle”, dato/recurrence-bekræftelse og valg mellem `Ikke nu` og `Vis ikke igen`.

Ikke V1:

- BBR-baseret eligibility, varmepumpe-, ventilation- og radiatoranbefalinger.
- Semantisk deduplikering mod manuelt oprettede opgaver.
- UI til at fortryde permanent skjulning.

## BBR data- og tilejusteringer

Status: Backlog — behandles efter Vedligeholdelse-scope.

- Gennemgå resterende BBR-datakoder, som endnu ikke oversættes til forståelige danske labels.
- Finjustér datavalg og produkttekster på de seks overblikskort på “Mit hus”.
- Kontrollér Boligtype, Boligareal, Byggeår, Værelser, Varme og Matrikel mod de korrekte produktværdier.
- Bevar det accepterede Mit hus-design; opgaven vedrører data, mapping og labels, ikke redesign.
- Verificér senere mod Ringstedgade 130, 4700 Næstved og Rosenstien 10, 9300 Sæby.
