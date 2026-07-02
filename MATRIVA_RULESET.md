Reglsæt for Matriva

# Codex-regler: Matriva native app deployment-ready udvikling

## Formål

Codex skal udvikle Matriva, så appen løbende overholder kravene til deployment på både Apple App Store og Google Play. Målet er, at vi kun laver endelig review før deploy – ikke større refaktorering.

## Gælder for

* iOS app
* Android app
* Shared frontend/business logic
* Backend/API-kald
* Auth, dokumenter, billeder, notifikationer og deling

## Grundregel

Ingen feature må bygges uden samtidig at tage højde for:

* Privacy
* Security
* Permissions
* App review
* Performance
* Accessibility
* Metadata/begrundelser
* Sletning af konto/data
* Audit/logging hvor relevant

## Development rules

All development in this repository must follow `MATRIVA_RULESET.md`.

No feature is considered done unless it satisfies the rules for:

* privacy
* security
* permissions
* Apple App Store review readiness
* Google Play review readiness
* data inventory
* accessibility
* error handling
* documentation

## Cross-platform native rules

Matriva skal bygges som én React Native / Expo kodebase til både iOS og Android.

Codex må ikke oprette separate native kodebaser for iOS og Android uden eksplicit beslutning.

Codex må ikke oprette separate Swift/iOS og Kotlin/Android app codebases uden eksplicit instruktion.

Platform-specifik kode må kun bruges når:

* iOS og Android kræver forskellig permission-tekst
* platformen har forskellig native behavior
* app review kræver platform-specifik metadata
* build config kræver det
* platform-specific UI conventions kræver det

Al platform-specifik kode skal:

* isoleres i tydelige filer
* dokumenteres med begrundelse
* have fallback eller tilsvarende adfærd på den anden platform
* testes på begge platforme hvor relevant

Når platform-specifik kode introduceres, skal Codex dokumentere:

* hvorfor delt kode ikke er tilstrækkeligt
* hvilken platform der påvirkes
* review/compliance impact
* testkrav for begge platforme

Codex skal prioritere fælles komponenter, fælles domain logic, fælles API-client, validation schemas og UI components.

## Expo / build rules

Matriva bruger Expo development builds, ikke kun Expo Go, når features kræver native capabilities.

Codex skal holde appen kompatibel med EAS Build og lokal build, hvor muligt.

Codex må ikke tilføje native dependencies uden:

* dokumenteret formål
* iOS-konsekvens
* Android-konsekvens
* permission-konsekvens
* Apple/Google review-konsekvens

## Hetzner backend rule

Matriva må ikke bruge Firebase som backend, database, storage, authentication, analytics eller Cloud Functions.

Backend-retningen er:

* Hetzner-hosted API
* PostgreSQL som source of truth
* server-side auth/session handling
* controlled object/file storage
* server-side reminders and notification dispatch
* GDPR export/delete support

Enhver foreslået tredjeparts-backend eller SDK kræver en eksplicit architectural decision record før implementation.

## Subscription and entitlement rules

Matriva uses a freemium model with a Free plan and a Pro subscription.

Codex must build subscription logic around backend-controlled entitlements, not hardcoded plan checks in the mobile app.

The mobile app may display cached entitlement state for UX, but the Matriva API is the source of truth for feature access.

Pro features may include:

* higher document limits
* full maintenance plan
* advanced reminders
* local homeowner advisories
* legal/regulatory updates
* secure sharing/export
* extended maintenance history

Free features must remain useful enough for users to understand Matriva's value.

Codex must not implement dark-pattern paywalls, misleading trial flows, hidden renewal terms, or confusing subscription states.

Any subscription implementation must document:

* Apple App Store impact
* Google Play impact
* product IDs
* entitlement mapping
* trial/intro offer behavior
* cancellation/expired subscription behavior
* data retention after downgrade
* refund/revocation handling
* backend webhook behavior

Subscription state must support at minimum:

* free
* trial
* active
* grace period
* billing issue
* expired
* cancelled
* refunded/revoked

If a user downgrades from Pro to Free, Matriva must not delete private data automatically. Instead, the app must restrict creation of new Pro-only resources and clearly explain read-only or over-limit behavior.

## Platform compliance

### Apple App Store

Codex skal sikre, at implementationen kan godkendes under:

* Safety
* Performance
* Business
* Design
* Legal
* App Privacy / Privacy Nutrition Labels
* Privacy manifests for relevante SDK’er
* Korrekt brug af permissions
* Ingen skjulte eller udokumenterede dataflows

### Google Play

Codex skal sikre, at implementationen kan godkendes under:

* Google Play Developer Program Policies
* User Data policy
* Data Safety section
* Permissions/API declarations
* Account deletion requirements
* Review access/demo-login hvis appen kræver login
* Korrekt privacy policy alignment

## Matriva-specifikke regler

### Data

Matriva håndterer følsomme hus- og personrelaterede data. Codex skal derfor:

* minimere indsamling af data
* gemme kun nødvendige felter
* undgå tracking uden eksplicit beslutning
* dokumentere alle datatyper
* skelne mellem brugerdata, husdata, dokumentdata og delingsdata
* sikre sletning/eksport hvor relevant

### Dokumenter og billeder

Ved upload, scan eller foto:

* brug kun camera/photo/file permissions når brugeren aktivt starter handlingen
* forklar formålet tydeligt i UI
* upload aldrig automatisk uden brugerhandling
* gem metadata minimalt
* beskyt download-URL’er
* brug adgangskontrol pr. hus/bruger/deling

### Notifikationer

Push-notifikationer må kun aktiveres efter tydelig brugerhandling.
Codex skal:

* bygge opt-in flow
* give mulighed for at slå notifikationer fra
* undgå spam
* knytte notifikationer til konkrete vedligeholdelsesopgaver

### Deling/eksport

Share/export er sekundær funktion og skal bygges sikkert:

* read-only som default
* udløbsdato på delte links
* mulighed for at trække adgang tilbage
* ingen offentlig adgang uden eksplicit valg
* log hvem der har adgang
* ingen framing som salgsplatform

### Konto og sletning

Codex skal fra start understøtte:

* bruger kan slette konto
* bruger kan anmode om/slette egne data
* delte links ophører ved relevant sletning
* backend må ikke efterlade orphan private data

## Permissions-regler

Codex må ikke tilføje permissions uden:

* konkret feature-behov
* kort begrundelse
* UI-copy til brugeren
* platform-konsekvens vurderet

Eksempler:

* Camera: kun til scanning/foto af dokumenter eller vedligehold
* Photos/files: kun til brugerinitieret upload
* Notifications: kun til påmindelser
* Location: må ikke bruges i MVP uden særskilt beslutning

## SDK-regler

Codex må ikke tilføje tredjeparts-SDK’er uden at dokumentere:

* formål
* hvilke data SDK’et kan tilgå
* om SDK’et tracker
* Apple privacy manifest-behov
* Google Data Safety-konsekvens
* alternativ uden SDK

Analytics/crash reporting må kun implementeres privacy-first og uden reklame-/trackingformål, medmindre andet er besluttet.

## Billing SDK rule

Codex must not add billing SDKs without explicit approval.

If RevenueCat or another billing abstraction is used, Codex must document:

* why the SDK is needed
* what data is shared with the SDK
* Apple privacy manifest impact
* Google Data Safety impact
* webhook/security requirements
* fallback behavior if billing status cannot be verified

## UI/UX-regler

Codex skal sikre:

* login virker stabilt
* tomme states er forståelige
* fejlbeskeder er brugbare
* appen kan reviewes uden særlig forklaring
* ingen døde knapper eller placeholder-features
* accessibility tænkes ind: kontrast, tekststørrelse, labels, touch targets

## Performance-regler

Codex skal:

* undgå tunge uploads på main thread
* komprimere billeder hvor relevant
* vise loading/progress ved upload
* håndtere offline/netværksfejl pænt
* undgå crashes ved manglende data
* sikre graceful fallback

## Review readiness

For hver feature skal Codex opdatere eller oprette:

* data inventory
* permission inventory
* review notes
* test account-behov
* privacy policy impact
* Apple/Google metadata impact

## Definition of Done

En feature er ikke færdig før:

* den virker funktionelt
* permissions er begrundet
* dataflow er dokumenteret
* privacy impact er vurderet
* fejlscenarier er håndteret
* accessibility er vurderet
* Apple/Google review-risiko er noteret
* der ikke er hardcoded secrets
* der ikke er skjult tracking
* der er testet på både iOS og Android, hvor relevant

## Stop-regel

Hvis Codex opdager, at en feature kan skabe platform review-risiko, skal Codex stoppe og tydeligt markere:

* hvad risikoen er
* hvilken platform den rammer
* anbefalet løsning
* om det kræver produktbeslutning
