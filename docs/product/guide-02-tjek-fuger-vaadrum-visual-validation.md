# Guide 02 – Tjek fuger i vådrum · visual validation

Guide 02 text and visual series are human-approved. This document records the derived visual series and its technical checkpoint.

## Bathroom source-of-truth

House A canonical geometry defines one bathroom room:

```text
bathroom · x 5800 mm · y 3500 mm · 2200 × 2500 mm
```

The canonical room map does not define bathroom interior geometry, bathroom openings, tile layout, fixtures or interior materials. The A11–A15 bathroom images are retained pilot references, not canonical interior authority. A separate derived reference was therefore created to lock the visual environment without changing House A source-of-truth.

Reference: `docs/product/house-a-bathroom-reference-v1.json`

## Minimum visual series

The approved guide text requires five distinct instructional roles. The cover and derived bathroom reference intentionally use the same image so the series has five guide placements but only one overview environment.

| ID | Guide section/step | Instructional purpose | Motif | Crop | Human interaction | Technical validation | Human approval |
|---|---|---|---|---|---|---|---|
| `gasset_house_a_bathroom_reference_v1` | cover / preparation | Orient the user to visible wet-room surfaces | Same House A bathroom, shower and visible joints | context overview, 16:9 | NO | PASS | APPROVED |
| `gasset_wetroom_shower_v1` | step 2 | Make corners and floor/wall transitions inspectable | Shower corner, screen, corner joint and floor/wall transition | medium close-up, 16:9 | NO | PASS | APPROVED |
| `gasset_wetroom_cracked_joint_v1` | step 1 / professional help | Show a modest visible crack/local opening that warrants follow-up | Small hairline crack and local grout edge loss | sharp joint detail, 16:9 | NO | PASS | APPROVED |
| `gasset_wetroom_discoloration_v1` | step 3 | Show discoloration as an observation, without diagnosing cause | Local muted color change in visible grout | sharp joint detail, 16:9 | NO | PASS | APPROVED |
| `gasset_wetroom_intact_joint_v1` | completion check | Provide a direct visual comparison for an intact visible joint | Continuous intact grout joint | sharp joint detail, 16:9 | NO | PASS | APPROVED |

Five placements are the minimum good series because each maps to a distinct instruction in the approved content: orientation, transitions, crack/opening, discoloration, and intact comparison. No repair image is included because the guide explicitly excludes repair, removal, scraping and sealing.

## Per-asset validation

| Asset | Same bathroom identity | Room/interior consistency | Tile geometry | Joint geometry | Defect realism | Severity | Inspection correctness | Human anatomy | Tool realism | Safety representation | AI artefacts | Instructional clarity | Match to approved text |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| overview | PASS | PASS | PASS | PASS | N/A | N/A | PASS | N/A | N/A | PASS | PASS | PASS | PASS |
| shower | PASS | PASS | PASS | PASS | N/A | N/A | PASS | N/A | N/A | PASS | PASS | PASS | PASS |
| cracked joint | PASS | NOT_VISIBLE | PASS | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS |
| discoloration | PASS | NOT_VISIBLE | PASS | PASS | PASS | PASS | PASS | N/A | N/A | PASS | PASS | PASS | PASS |
| intact joint | PASS | NOT_VISIBLE | PASS | PASS | N/A | N/A | PASS | N/A | N/A | PASS | PASS | PASS | PASS |

## Defect realism

- `wetroom-cracked-joint-v1`: small hairline crack and localized edge loss; clear at inspection scale; routine early maintenance observation; not overdramatised.
- `wetroom-discoloration-v1`: localized muted color change; clearly visible; no diagnosis or hidden-construction claim; not overdramatised.

## Asset/provenance lifecycle

```text
House A canonical geometry
  -> bathroom room boundary only
House A A11–A15 pilot bathroom references
  -> derived House A bathroom reference v1
  -> five Guide 02 guide assets / placements
  -> technical validation PASS
  -> human visual approval APPROVED
```

All new assets bind to:

```text
guide_template_id: guide_tjek_fuger_vaadrum
guide_version_id: gver_tjek_fuger_vaadrum_v1
guide_key: tjek_fuger_vaadrum
house_profile_id: hprof_matriva_modern_2023
```

All assets are marked human-approved. Guide 02 remains a draft and is not published.
