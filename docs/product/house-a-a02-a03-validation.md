# House A A02/A03 – validation ved Human Approval Gate

Status: `APPROVED` · Human approval: `APPROVED` ved checkpoint `8b846b4`

Denne gate sammenholder de to fotorealistiske drafts med den samme godkendte canonical geometri. Maskinel validering kontrollerer bindinger, checksums, kameraer, openings og billedformat. Visuel validering kontrollerer de dele af AI-outputtet, som ikke kan bevises programmatisk på pixelniveau.

| Kontrol | A02 FRONT | A03 REAR/GARDEN |
|---|---|---|
| Canonical kamera | PASS – `CAM_FRONT` | PASS – `CAM_REAR` |
| Ét rektangulært étplansvolumen | PASS | PASS |
| Ét sammenhængende 25° valmtagsprincip | PASS | PASS |
| Facade-openings | PASS – 4/4 i canonical rækkefølge | PASS – 4/4, synligt stor–lille–stor–lille |
| Nedløb i facadehjørner | PASS – 2 | PASS – 2 |
| Site-relation | PASS – garageindkørsel og hovedsti | PASS – rear-terrasse og have |
| Interiør/room map | PASS – to separate værelser | PASS – stue, køkken/alrum og soveværelse er adskilt |
| A01-materialeudtryk | PASS | PASS |
| Uautoriseret geometri | Ingen observeret | Ingen observeret |

Konklusion: A02 og A03 er dokumenteret og menneskeligt godkendt som to kameraer på den samme canonical House A-model. En senere AI-render eller billedredigering må aldrig bruges til at ændre canonical geometri.
