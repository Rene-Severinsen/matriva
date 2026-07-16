# MATRIVA_SCOPE_V1.md

## Formål

Matriva V1 er en native-first boligejer-app, der hjælper brugeren med at få styr på husets vigtigste vedligeholdelse, dokumenter og påmindelser.

V1 skal bevise én ting:

**Vil en boligejer bruge Matriva som husets praktiske hukommelse?**

## Produktprincip

Matriva skal være rolig, praktisk og handlingsorienteret.

Appen skal ikke være en nyhedsapp, salgsapp, byggesagkyndig rådgiver eller komplet boligplatform.

Appen skal hjælpe brugeren med:

* hvad skal jeg gøre nu?
* hvad skal jeg huske senere?
* hvor ligger dokumentationen?
* hvad er relevant for mit hus?

## Teknisk hovedretning

Matriva V1 bygges som:

* native-first mobilapp
* én React Native / Expo kodebase til iOS og Android
* ingen Firebase
* Hetzner-hosted backend/API
* PostgreSQL som source of truth
* kontrolleret fil-/object storage
* backend-styrede entitlements
* backend-drevet dynamisk indhold

## Arkitekturprincip

Appen skal være en stabil native shell.

Backend skal være hjernen.

Appen skal ikke hardcode vedligeholdelseskataloger, lovgivning, lokale advarsler eller Pro-regler. Den skal hente relevante cards, opgaver og anbefalinger fra backend.

## V1 målgruppe

Danske boligejere, primært:

* førstegangshusejere
* travle familier
* husejere med løse dokumenter, kvitteringer og vedligeholdelsesopgaver
* husejere der vil have overblik uden at skulle bygge et system selv

## V1 kerneflow

Brugeren skal kunne:

1. oprette konto
2. oprette sit hus via adresse
3. se basis husprofil
4. få en første vedligeholdelsesplan
5. se næste relevante opgave
6. markere opgave som udført
7. gemme dokumentation/billede
8. få relevante påmindelser
9. forstå forskel på Free og Pro

## V1 app-skærme

V1 må kun have disse primære skærme:

1. Welcome / login
2. Adresseopslag
3. Bekræft hus
4. Home
5. Opgaver
6. Opgavedetalje
7. Log udført opgave
8. Dokumenter
9. Tilføj dokument
10. Mit hus
11. Beskeder/advarsler
12. Profil/indstillinger
13. Abonnement/Pro
14. Slet konto/data

Ingen øvrige hovedmoduler må tilføjes i V1 uden særskilt scope-beslutning.

## Home-princip

Home skal vise:

1. næste vigtige handling
2. kommende relevante opgaver
3. manglende dokumentation
4. relevante advarsler eller anbefalinger
5. hurtige handlinger

Home må ikke blive et tungt dashboard.

## Backend V1 scope

Backend skal understøtte:

* bruger
* login/session
* hus
* basis boligdata
* opgaveskabeloner
* brugeropgaver
* dynamiske cards
* dokumentmetadata
* filupload
* push token storage
* simpel notification scheduler
* abonnement/entitlements
* audit basics
* konto- og datasletning

## Dynamic content V1

Backend skal kunne levere dynamisk indhold til appen som cards.

V1 card types:

* TASK_REMINDER
* MISSING_DOCUMENT
* SEASONAL_RECOMMENDATION
* LOCAL_WARNING
* LEGAL_UPDATE
* DOCUMENT_EXPIRY
* SUBSCRIPTION_LIMIT
* SYSTEM_NOTICE

Alle cards skal have:

* type
* titel
* kort forklaring
* severity
* handling
* kilde hvor relevant
* gyldighedsperiode
* målgruppekriterier
* minAppVersion
* fallbackText

## Vedligeholdelse V1

V1 skal understøtte:

* standardopgaver fra backend
* opgaver knyttet til hus
* forfaldsdato
* gentagelsesinterval
* sæson
* status
* markér som udført
* log note
* tilføj dokument/billede til udført opgave

V1 skal ikke understøtte komplekse projekter, håndværkerstyring eller tilbudsindhentning.

## Dokumenter V1

V1 skal understøtte:

* upload af dokument eller billede
* kategori
* titel
* tilknytning til hus
* tilknytning til opgave, hvis relevant
* udløbsdato/garanti, hvis relevant
* listevisning
* sikker adgang via backend

Free kan have begrænset antal dokumenter. Pro kan have højere grænse.

## Push-notifikationer V1

Push skal være opt-in.

V1 notifikationer må kun handle om:

* konkrete opgaver
* dokument-/garantiudløb
* relevante advarsler
* vigtige systembeskeder

Ingen spam, marketing-push eller støj.

## Free / Pro V1

Matriva skal have freemium-model.

### Free

Free skal være nyttig nok til, at brugeren forstår værdien.

Free kan indeholde:

* 1 bolig
* basis husprofil
* begrænset antal dokumenter
* begrænset antal aktive opgaver
* basis påmindelser
* få standardopgaver

### Pro

Pro skal give løbende tryghed og mere nytte.

Pro kan indeholde:

* flere dokumenter / højere lagergrænse
* fuld vedligeholdelsesplan
* avancerede påmindelser
* sæsonbaserede anbefalinger
* lokale advarsler
* lov-/regelopdateringer
* dokumentudløb/garantier
* sikker deling/eksport
* udvidet historik

## Subscription-princip

Backend er source of truth for entitlements.

Appen må ikke hardcode Pro-adgang som simple plan-checks.

Entitlements skal kunne styre:

* documents.maxCount
* documents.maxStorageMb
* tasks.maxActive
* advisories.enabled
* legalUpdates.enabled
* sharing.enabled
* export.enabled
* advancedReminders.enabled

Betalingsintegration kan implementeres senere, men arkitekturen skal være klar fra start.

## Ikke V1

Følgende er eksplicit ikke V1:

* håndværkerportal
* tilbudsindhentning
* avanceret OCR
* AI-rådgiver
* marketplace
* multi-house
* familie-/teamroller
* komplet adminsystem
* betaling via ekstern web uden app store compliance
* salgsplatform
* mæglerflow som kernefunktion
* kompleks GIS
* automatisk nyhedsindlæsning/crawler


## V1 authentication decision

Account creation and login in V1 are implemented with backend-owned email magic links, rotating sessions, SecureStore-backed mobile restore, profile onboarding, and backend-computed onboarding state. The previous DevUser boundary is no longer the normal runtime identity and may only remain as an explicit development fixture.
