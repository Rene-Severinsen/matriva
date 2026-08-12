# House A A04/A05 – validation ved Human Approval Gate

Status: `HISTORICAL_PRE_CORRECTION_VALIDATION` · superseded af human-approved A05 drainage-v2 den `2026-08-12`

A04 og A05 er afledt fra de eksisterende låste `CAM_LEFT` og `CAM_RIGHT`. Ingen canonical geometri, kameraværdi, A01-, A02- eller A03-billedfil er ændret. Maskinel validering kontrollerer checksums, kamera-bindinger, opening-ID’er, billedformat og scope; visuel validering kontrollerer AI-renderens facade- og materialelæsning.

| Kontrol | A04 LEFT | A05 RIGHT |
|---|---|---|
| Canonical kamera | PASS – `CAM_LEFT` | PASS – `CAM_RIGHT` |
| Ét rektangulært étplansvolumen | PASS | PASS |
| Samme valmtag / trekantet sideprojektion | PASS | PASS |
| Facade-openings | PASS – master-vindue → garage-sidedør | PASS – mindre bedroom-vindue → bredere living-vindue |
| Uautoriseret opening | Ingen | Ingen; ingen dør |
| Nedløb | PASS – kun de 2 facadehjørner | FAIL – venstre nedløb er korrekt; højre nedløb står inde på facaden og skal flyttes til det fysiske højre facadehjørne |
| Interiør/room map | PASS – master bedroom; garage-sidedør er opak | PASS – bedroom 2 og living room er adskilt |
| Canonical site-relation | PASS – west bed/tree og perifere faste flader | PASS – east bed/tree og perifere faste flader |
| A01/A02/A03-seriekonsistens | PASS | PASS |
| Uautoriseret bygningsgeometri | Ingen observeret | Ingen observeret |

Arkitekt-testen består visuelt for bygningsvolumen, tag og openings. A04's geometri er efterfølgende human-approved. A05 har en separat, åben drainage-fejl: det eksisterende venstre nedløb er reference og skal bevares; højre nedløb og tagrendens forbindelse skal korrigeres ud fra canonical roof geometry, RIGHT elevation, `CAM_RIGHT` og geometric preview.

Begrænsning: Et AI-genereret pixelbillede kan ikke bevises matematisk alene. Dokumentationen består derfor af matching deterministic preview, låst kamera, checksums/provenance, canonical elevation/plan og manuel visuel sammenligning. De centrerede sideviews viser ikke hele garage- eller terrasseplanen; deres kontinuitet dokumenteres af canonical model samt de godkendte front/rear-views.

Konklusion: A04 bevarer status `GEOMETRY_APPROVED`, mens det nye facade-materiale kræver en ny human approval. A05 kræver human approval af både pudset facade og drainage-korrektion. En render må aldrig ændre canonical geometri.

## Efterfølgende resolution

Rapportens FAIL-observation dokumenterer den tidligere A05-version og må ikke omskrives væk. Fejlen blev korrigeret i `a05-right-rendered-facade-natural-garden-drainage-candidate-v2.png`; denne byte-identiske fil blev human-approved den 2026-08-12 og promoveret til `a05-right-canonical-v1.png`. Den aktuelle autoritet ligger i `house-a-canonical-render-manifest.json`.
