# House A – pudset facade, naturlig have, A02 dørgreb og A05 drainage

Status: `HUMAN_APPROVED` den `2026-08-12` · promoveret som `CURRENT_CANONICAL_REFERENCE`

Alle fem kandidater er constrained edits af de bevarede originals. Canonical geometry, cameras, opening schedule, room/interior map og permanent site-struktur er uændrede.

| Kontrol | A01 | A02 | A03 | A04 | A05 |
|---|---|---|---|---|---|
| Lys pudset facade; ingen murværksgrid | PASS | PASS | PASS | PASS | PASS |
| Samme facade-tone/struktur | Reference | PASS | PASS | PASS | PASS |
| Geometry/openings/camera bevaret | PASS | PASS – geometry approved | PASS – geometry approved | PASS – geometry approved | PASS – geometry validated |
| Room/interior visibility bevaret | N/A | PASS | PASS | PASS | PASS |
| Permanent site-struktur bevaret | PASS | PASS | PASS | PASS | PASS |
| Kuglebusk-repetition reduceret | PASS | PASS | PASS | PASS | PASS |
| Varierede stauder/blomster/græsser | PASS | PASS | PASS | PASS | PASS |
| Nye permanente træer | Ingen | Ingen | Ingen | Ingen | Ingen |
| Drainage | Bevaret | Bevaret | Bevaret | Bevaret | PASS – corrected drainage v2 human-approved |
| Hoveddørsgreb | N/A | PASS – præcis ét greb til venstre i billedrummet | N/A | N/A | N/A |

## A02 hoveddørsgreb

A02-v1 blev afvist som slutkandidat, fordi hoveddøren viste to greb. Den valgte v3 fjerner udelukkende det fejlagtige greb til højre ved den rapporterede position `(x: 55,1 %, y: 57,6 %)` og bevarer grebet til venstre. Korrektionen regenereres deterministisk ved lodret interpolation fra ren dørflade; den verificerede ændringsmaske er begrænset til pixel-bounds `x=897..939`, `y=511..565`, og nul pixels uden for masken ændres. Canonical geometry, kamera, åbninger og alle øvrige billedelementer er fortsat beskyttede. Pixelkorrektionen blev human-approved den 2026-08-12.

## A05 drainage

Det venstre nedløb er bevaret. Første særskilte drainage-edit blev afvist, fordi højre rør forblev på den tidligere inset-position. Den valgte v2 flytter røret mod den fysiske højre facadeafslutning/side-return-overgang og bevarer en kontinuerlig tagrende under den ydre tagkant. V2 blev human-approved den 2026-08-12. Det frosne approval-board er den bindende human-review-flade; maskinel checksum-/provenance-validering kan ikke alene bevise pixelgeometrien.

## Approval-resultat 2026-08-12

- `FACADE`: `HUMAN_APPROVED`.
- `GARDEN`: `HUMAN_APPROVED`.
- `HOUSE_CONSISTENCY`: `HUMAN_APPROVED`.
- `A02_DOOR_HANDLE`: `HUMAN_APPROVED`.
- `A05_DRAINAGE`: `HUMAN_APPROVED`.

Godkendelsen gør serien til current canonical reference, ikke immutable forever. Fremtidige ændringer skal være eksplicitte, versionsstyrede, dokumenterede, provenance-bevarende og validerede med ny human approval, hvor referencegrundlaget ændres.
