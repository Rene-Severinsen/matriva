# BBR field coverage audit v1

Date: 2026-07-16

This document describes the implemented Matriva BBR house profile after the profile integration sprint. It is not a value-priority classification. Every agreed product field is either implemented through the current Datafordeler GraphQL source path or marked with explicit provider/schema availability.

## Implemented pipeline

```text
Datafordeler GraphQL
-> typed raw payload in DatafordelerRawPayload
-> mapPublicData normalized house_public_data.v1
-> raw_payload, normalized_payload, and child raw_normalized JSONB
-> dedicated house_public_* SQL projections
-> house_public_data_profile.v1 builder
-> GET /v1/houses/:id/public-data
-> packages/api-client typed parse
-> Mit hus profile UI
```

Raw provider payload is persisted for audit/regeneration but is not returned through the mobile API.

## Schema verification result

GraphQL introspection did not expose usable field lists for the BBR object types. The sprint therefore used schema-guided errors plus small targeted live queries. The following ASCII-normalized fields were accepted and implemented:

| Entity | Product field | Verified GraphQL field |
|---|---|---|
| `BBR_Bygning` | ydervaegsmateriale | `byg032YdervaeggensMateriale` |
| `BBR_Bygning` | tagmateriale | `byg033Tagdaekningsmateriale` |
| `BBR_Bygning` | supplerende materiale/asbest source field | `byg034SupplerendeYdervaeggensMateriale` |
| `BBR_Bygning` | lukkede overdaekninger | `byg046SamletArealAfLukkedeOverdaekningerPaaBygningen` |
| `BBR_Bygning` | oevrigt areal/affaldsrum | `byg047ArealAfAffaldsrumITerraenniveau` |
| `BBR_Enhed` | koekkenforhold | `enh034Koekkenforhold` |

The following tested fields are not exposed on the current Datafordeler GraphQL type and are represented as `source_unavailable` where relevant:

| Entity | Product field | Tested field |
|---|---|---|
| `BBR_Enhed` | antal vandskyllende toiletter | `enh065AntalVandskyllendeToiletter` |
| `BBR_Enhed` | unit-level supplerende varme | `enh105SupplerendeVarme` |
| `BBR_Enhed` | unit-level varmeinstallation | `enh132Varmeinstallation` |
| `BBR_Enhed` | unit-level opvarmningsmiddel | `enh133Opvarmningsmiddel` |
| `BBR_Etage` | etagetype | `eta024EtageType` |
| `BBR_Etage` | adgangsareal | `eta025Adgangsareal` |

Building-level heating is the authoritative implemented heating source path.

## Availability semantics

The normalized contract now has a small availability vocabulary:

- `value`: the field is supported and has a value.
- `registered_empty`: the field is supported but BBR has no registered value in the current response.
- `source_unavailable`: the field is not exposed by the current provider/schema path.
- `fetch_failed`: the field could not be fetched in the latest refresh.
- `not_relevant`: the field is not applicable and should be hidden.

The mobile UI maps these to distinct messages such as `Ikke registreret i BBR` and `Ikke tilgængeligt fra datakilden`.

The availability bug found by the database audit is fixed in the mapper. Building `heating`, `materials`, and `coveredArea` are now `value` only when at least one relevant normalized value exists. Supported-but-empty sections are `registered_empty`.

## Codebook corrections

The Ringstedgade audit showed several fetched and persisted codes with `label: null` and `known: false`. These codebooks are now completed for the documented values:

| Codebook | Code | Label |
|---|---:|---|
| lifecycle | `10` | Fejlregistreret |
| outer wall material | `1` | Mursten (tegl, kalksten, cementsten) |
| roof material | `5` | Fibercement, herunder asbest |
| unit housing type | `1` | Egentlig beboelseslejlighed |
| unit area source | `1` | Oplyst af ejer |
| unit toilet | `T` | Vandskyllende toilet i enheden |
| unit bath | `V` | Badeværelse i enheden |
| unit kitchen | `E` | Eget køkken med afløb |
| unit address function | `0` | Enhedens adresse |
| ground water supply | `1` | Alment vandforsyningsanlæg |
| ground sewer | `10` | Fælleskloakeret: spildevand + tag- og overfladevand |

Unknown codes are still preserved with `known: false`.

## Construction year guard

`presentableConstructionYear` centralizes product display of construction years. Raw and normalized data may still preserve a source value such as `1000`, but summary/profile builders do not present years below the product minimum as ordinary construction years. This prevents lifecycle `10` buildings from displaying `1000` as a normal build year.

## Coverage matrix

| Product area | Required product field | Verified source field | Queried | Mapped | Normalized | Dedicated SQL | API profile | Mobile section | Availability |
|---|---|---|---:|---:|---:|---|---:|---|---|
| Address/location | address label | `DAR_Adresse.adressebetegnelse` | Yes | Yes | Yes | JSONB | Yes | Lokation | value/registered_empty |
| Address/location | DAR address id | `DAR_Adresse.id_lokalId` | Yes | Yes | Yes | JSONB | Indirect | Datakilde | value |
| Address/location | house number/postal relation | `adresseHarHusnummer` | Yes | Yes | Yes | JSONB | Yes | Lokation | value/registered_empty |
| Property | BFE | `grundSamletFastEjendom.bfeNummer` | Yes | Yes | Yes | JSONB | Yes | Ejendom | value/registered_empty |
| Property | vurderingsejendomsnummer | `vurderingsejendomsnummer` | Yes | Yes | Yes | snapshot SQL + JSONB | Yes | Ejendom | value/registered_empty |
| Property | municipality code | `grundSamletFastEjendom.kommunekode` | Yes | Yes | Yes | snapshot SQL + JSONB | Yes | Ejendom | value/registered_empty |
| Ground | BBR ground id | `BBR_Grund.id_lokalId` | Yes | Yes | Yes | JSONB | Yes | Grund og matrikel | value |
| Ground | vandforsyning | `gru009Vandforsyning` | Yes | Yes | Yes | JSONB | Yes | Grund og matrikel | value/registered_empty |
| Ground | afloebsforhold | `gru010Afloebsforhold` | Yes | Yes | Yes | JSONB | Yes | Grund og matrikel | value/registered_empty |
| Parcels | matrikelnummer | `bygningJordstykke.matrikelnummer` | Yes | Yes | Yes | `house_public_parcels.cadastral_number` | Yes | Grund og matrikel | value/registered_empty |
| Parcels | ejerlav | not exposed on `MAT_Jordstykke` through current relation | No | availability only | Yes | `owner_district_id` nullable | Yes | Grund og matrikel | source_unavailable |
| Parcels | kommune | not exposed on `MAT_Jordstykke` through current relation | No | availability only | Yes | `municipality_id` nullable | Yes | Grund og matrikel | source_unavailable |
| Building | identity | `id_lokalId` | Yes | Yes | Yes | `bbr_building_id` | Yes | Bygningen/Andre bygninger | value |
| Building | building number | `byg007Bygningsnummer` | Yes | Yes | Yes | `building_number` | Yes | Bygningen | value/registered_empty |
| Building | lifecycle/status | `status` | Yes | Yes | Yes | `lifecycle_code` | Yes | Datakilde/Andre bygninger | value |
| Building | use | `byg021BygningensAnvendelse` | Yes | Yes | Yes | `use_code` | Yes | Bygningen | value/registered_empty |
| Building | construction year | `byg026Opfoerelsesaar` | Yes | Yes | Yes | `construction_year` | Yes | Topkort/Bygningen | value/registered_empty |
| Building | remodel/extension year | `byg027OmTilbygningsaar` | Yes | Yes | Yes | `remodel_or_extension_year` | Yes | Bygningen | value/registered_empty |
| Building | total area | `byg038SamletBygningsareal` | Yes | Yes | Yes | `total_building_area_m2` | Yes | Arealer | value/registered_empty |
| Building | residential area | `byg039BygningensSamledeBoligAreal` | Yes | Yes | Yes | `residential_area_m2` | Yes | Topkort/Arealer | value/registered_empty |
| Building | commercial area | `byg040BygningensSamledeErhvervsAreal` | Yes | Yes | Yes | `commercial_area_m2` | Yes | Arealer | value/registered_empty |
| Building | footprint area | `byg041BebyggetAreal` | Yes | Yes | Yes | `footprint_area_m2` | Yes | Bygningen/Arealer | value/registered_empty |
| Building | integrated garage | `byg042ArealIndbyggetGarage` | Yes | Yes | Yes | `integrated_garage_m2` | Yes | Bygningen | value/registered_empty |
| Building | integrated carport | `byg043ArealIndbyggetCarport` | Yes | Yes | Yes | `integrated_carport_m2` | Yes | Bygningen | value/registered_empty |
| Building | integrated outbuilding | `byg044ArealIndbyggetUdhus` | Yes | Yes | Yes | `integrated_outbuilding_m2` | Yes | Bygningen | value/registered_empty |
| Building | integrated conservatory | `byg045ArealIndbyggetUdestueEllerLign` | Yes | Yes | Yes | `integrated_conservatory_m2` | Yes | Bygningen | value/registered_empty |
| Building | covered area | `byg046SamletArealAfLukkedeOverdaekningerPaaBygningen` | Yes | Yes | Yes | `covered_area_m2` | Yes | Bygningen | value/registered_empty |
| Building | other registered area | `byg047ArealAfAffaldsrumITerraenniveau` | Yes | Yes | Yes | `other_area_m2` | Yes | Bygningen | value/registered_empty |
| Building | floor count | `byg054AntalEtager` | Yes | Yes | Yes | `registered_floor_count` | Yes | Bygningen | value/registered_empty |
| Materials | outer wall | `byg032YdervaeggensMateriale` | Yes | Yes | Yes | `outer_wall_code` | Yes | Materialer | value/registered_empty |
| Materials | roof | `byg033Tagdaekningsmateriale` | Yes | Yes | Yes | `roof_code` | Yes | Materialer | value/registered_empty |
| Materials | supplementary material | `byg034SupplerendeYdervaeggensMateriale` | Yes | Yes | Yes | `supplementary_outer_wall_code` | Yes | Materialer | value/registered_empty |
| Heating | installation | `byg056Varmeinstallation` | Yes | Yes | Yes | `heating_installation_code` | Yes | Topkort/Varme | value/registered_empty |
| Heating | source | `byg057Opvarmningsmiddel` | Yes | Yes | Yes | `heating_source_code` | Yes | Varme | value/registered_empty |
| Heating | supplementary | `byg058SupplerendeVarme` | Yes | Yes | Yes | `supplementary_heating_code` | Yes | Varme | value/registered_empty |
| Unit | identity/building/floor relation | `id_lokalId`, `bygning`, `etage` | Yes | Yes | Yes | ids | Yes | Boligen | value/registered_empty |
| Unit | lifecycle/status | `status` | Yes | Yes | Yes | `lifecycle_code` | Yes | Boligen | value |
| Unit | use | `enh020EnhedensAnvendelse` | Yes | Yes | Yes | `use_code` | Yes | Boligen | value/registered_empty |
| Unit | housing type | `enh023Boligtype` | Yes | Yes | Yes | `housing_type_code` | Yes | Topkort/Boligen | value/registered_empty |
| Unit | total area | `enh026EnhedensSamledeAreal` | Yes | Yes | Yes | `total_area_m2` | Yes | Boligen/Arealer | value/registered_empty |
| Unit | residential area | `enh027ArealTilBeboelse` | Yes | Yes | Yes | `residential_area_m2` | Yes | Topkort/Boligen | value/registered_empty |
| Unit | commercial area | `enh028ArealTilErhverv` | Yes | Yes | Yes | `commercial_area_m2` | Yes | Boligen | value/registered_empty |
| Unit | area source | `enh030KildeTilEnhedensArealer` | Yes | Yes | Yes | `area_source_code` | Yes | Boligen | value/registered_empty |
| Unit | rooms | `enh031AntalVaerelser` | Yes | Yes | Yes | `room_count` | Yes | Topkort/Boligen | value/registered_empty |
| Unit | toilet | `enh032Toiletforhold` | Yes | Yes | Yes | `toilet_type_code` | Yes | Boligen | value/registered_empty |
| Unit | bath | `enh033Badeforhold` | Yes | Yes | Yes | `bath_type_code` | Yes | Boligen | value/registered_empty |
| Unit | kitchen | `enh034Koekkenforhold` | Yes | Yes | Yes | `kitchen_type_code` | Yes | Boligen | value/registered_empty |
| Unit | bathroom count | `enh066AntalBadevaerelser` | Yes | Yes | Yes | `bathroom_count` | Yes | Boligen | value/registered_empty |
| Unit | flex home | `enh068FlexboligTilladelsesart` | Yes | Yes | Yes | `flex_home_permission_code` | Yes | Boligen | value/registered_empty |
| Unit | address function | `enh071AdresseFunktion` | Yes | Yes | Yes | `address_function_code` | Yes | Boligen | value/registered_empty |
| Unit | registered area 1/2/3 | `enh102/103/104HerafAreal*` | Yes | Yes | Yes | `registered_area_*_m2` | Yes | Boligen/Arealer | value/registered_empty |
| Unit | physical residential area | `enh127FysiskArealTilBeboelse` | Yes | Yes | Yes | `physical_residential_area_m2` | Yes | Boligen | value/registered_empty |
| Unit | physical commercial area | `enh128FysiskArealTilErhverv` | Yes | Yes | Yes | `physical_commercial_area_m2` | Yes | Boligen | value/registered_empty |
| Unit | flush toilet count | not exposed on `BBR_Enhed` | No | availability only | Yes | nullable `flush_toilet_count` | Yes | Boligen | source_unavailable |
| Unit | unit heating | not exposed on `BBR_Enhed` | No | availability only | Yes | JSONB only | Yes via building heating | Varme | source_unavailable |
| Floor | identity/building relation | `id_lokalId`, `bygning` | Yes | Yes | Yes | ids | Yes | Etager og kaelder | value |
| Floor | lifecycle/status | `status` | Yes | Yes | Yes | `lifecycle_code` | Yes | Etager og kaelder | value |
| Floor | designation | `eta006BygningensEtagebetegnelse` | Yes | Yes | Yes | `designation` | Yes | Etager og kaelder | value/registered_empty |
| Floor | total floor area | `eta020SamletArealAfEtage` | Yes | Yes | Yes | `total_floor_area_m2` | Yes | Etager og kaelder | value/registered_empty |
| Floor | utilised attic | `eta021ArealAfUdnyttetDelAfTagetage` | Yes | Yes | Yes | `utilised_attic_area_m2` | Yes | Etager og kaelder | value/registered_empty |
| Floor | basement area | `eta022Kaelderareal` | Yes | Yes | Yes | `basement_area_m2` | Yes | Topkort/Etager og kaelder | value/registered_empty |
| Floor | legal residential basement | `eta023ArealAfLovligBeboelseIKaelder` | Yes | Yes | Yes | `legal_residential_basement_area_m2` | Yes | Etager og kaelder | value/registered_empty |
| Floor | commercial basement | `eta026ErhvervIKaelder` | Yes | Yes | Yes | `commercial_basement_area_m2` | Yes | Etager og kaelder | value/registered_empty |
| Floor | floor type | not exposed on `BBR_Etage` | No | availability only | Yes | nullable `floor_type_code` | Yes | Etager og kaelder | source_unavailable |
| Floor | access area | not exposed on `BBR_Etage` | No | availability only | Yes | nullable `access_area_m2` | Yes | Etager og kaelder | source_unavailable |

## Persistence

Migration `0004_house_public_data_profile_v1.sql` adds nullable projections for building, unit, and floor profile fields. Migration `0005_house_public_data_property_projection_v1.sql` adds nullable snapshot projections for BFE, property municipality code, and assessment property number. Existing snapshots are not backfilled. Existing houses need a new BBR refresh before the new dedicated columns are populated.

JSONB layers remain:

- `house_public_data_snapshots.raw_payload`: full provider snapshot for server-side audit/regeneration.
- `house_public_data_snapshots.normalized_payload`: full normalized `house_public_data.v1`.
- child `raw_normalized`: normalized building/unit/floor/parcel row payloads.

Dedicated SQL columns now cover central profile fields for buildings, units, and floors. They are queryable but do not replace JSONB.

The live-complex smoke now verifies that normalized JSON, child `raw_normalized`, and dedicated SQL projections match for central building, unit, floor, parcel, and property fields. Nulls must match nulls.

## API and mobile

`GET /v1/houses/:id/public-data` and `POST /v1/houses/:id/public-data/refresh` return `house_public_data.v1` plus a backend-built `profile` object with contract `house_public_data_profile.v1`.

The profile sections are:

- `location`
- `propertyIdentity`
- `primaryBuilding`
- `primaryUnit`
- `heating`
- `materials`
- `areas`
- `floorsAndBasement`
- `otherBuildings`
- `projectedBuildings`
- `groundAndParcels`
- `sourceAndQuality`

Mobile `Mit hus` renders the profile as compact top facts and foldable sections. Existing product buildings are shown separately from projected buildings. Null fields are hidden from top cards and rendered in detail with availability-aware wording.

## Test houses

Ringstedgade 130, 4700 Naestved live smoke validates:

- 2 source buildings
- 1 product building
- 1 unit
- 2 floors
- 1 parcel
- building use `120`
- construction year `1930`
- residential area `122 m2`
- 4 rooms
- 1 bathroom
- heating installation `2`
- heating source `7`
- supplementary heating `90`
- profile contract `house_public_data_profile.v1`
- lifecycle `10` is known as `Fejlregistreret`
- construction year `1000` is preserved in normalized audit data but not presented as a normal product year
- empty secondary-building heating/materials/covered-area availability is `registered_empty`

Rosenstien 10, 9300 Saeby live-complex smoke validates:

- 9 source buildings
- 6 existing product buildings
- 3 projected buildings
- 1 primary residential unit
- 2 floors
- 1 parcel
- 160 m2 residential area
- 6 rooms
- 1 bathroom
- 80 m2 basement
- heating installation `1`
- supplementary heating `2`
- garage, outbuildings, greenhouse, and covered building classifications through BBR use codes
- profile contract and no raw payload in API response
- relational child row persistence

## Known provider limitations

The current Datafordeler GraphQL schema path does not expose the tested unit flush-toilet count, unit-level heating fields, floor type, floor access area, or parcel owner-district/municipality fields on `MAT_Jordstykke`. They are not inferred. They are represented through availability rather than shown as ordinary empty BBR values.

Several codebooks remain intentionally incomplete. Unknown codes are preserved with `known: false` and `label: null`; the UI uses neutral fallback display and does not crash.
