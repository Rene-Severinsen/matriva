import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const querySource = readFileSync(
  new URL("../apps/api/src/public-data/datafordeler-client.ts", import.meta.url),
  "utf8"
);
const mapperSource = readFileSync(
  new URL("../apps/api/src/public-data/mapper.ts", import.meta.url),
  "utf8"
);
const sharedSource = readFileSync(
  new URL("../packages/shared/src/index.ts", import.meta.url),
  "utf8"
);

const requiredFields = {
  building: [
    "byg021BygningensAnvendelse",
    "byg026Opfoerelsesaar",
    "byg027OmTilbygningsaar",
    "byg032YdervaeggensMateriale",
    "byg033Tagdaekningsmateriale",
    "byg034SupplerendeYdervaeggensMateriale",
    "byg038SamletBygningsareal",
    "byg039BygningensSamledeBoligAreal",
    "byg040BygningensSamledeErhvervsAreal",
    "byg041BebyggetAreal",
    "byg042ArealIndbyggetGarage",
    "byg043ArealIndbyggetCarport",
    "byg044ArealIndbyggetUdhus",
    "byg045ArealIndbyggetUdestueEllerLign",
    "byg046SamletArealAfLukkedeOverdaekningerPaaBygningen",
    "byg047ArealAfAffaldsrumITerraenniveau",
    "byg054AntalEtager",
    "byg056Varmeinstallation",
    "byg057Opvarmningsmiddel",
    "byg058SupplerendeVarme"
  ],
  unit: [
    "enh020EnhedensAnvendelse",
    "enh023Boligtype",
    "enh026EnhedensSamledeAreal",
    "enh027ArealTilBeboelse",
    "enh028ArealTilErhverv",
    "enh030KildeTilEnhedensArealer",
    "enh031AntalVaerelser",
    "enh032Toiletforhold",
    "enh033Badeforhold",
    "enh034Koekkenforhold",
    "enh066AntalBadevaerelser",
    "enh068FlexboligTilladelsesart",
    "enh071AdresseFunktion",
    "enh102HerafAreal1",
    "enh103HerafAreal2",
    "enh104HerafAreal3",
    "enh127FysiskArealTilBeboelse",
    "enh128FysiskArealTilErhverv"
  ],
  floor: [
    "eta006BygningensEtagebetegnelse",
    "eta020SamletArealAfEtage",
    "eta021ArealAfUdnyttetDelAfTagetage",
    "eta022Kaelderareal",
    "eta023ArealAfLovligBeboelseIKaelder",
    "eta026ErhvervIKaelder"
  ],
  property: [
    "bfeNummer",
    "kommunekode",
    "vurderingsejendomsnummer"
  ],
  parcel: [
    "matrikelnummer"
  ]
};

const sourceUnavailableFields = [
  "enh065AntalVandskyllendeToiletter",
  "enh105SupplerendeVarme",
  "enh132Varmeinstallation",
  "enh133Opvarmningsmiddel",
  "eta024EtageType",
  "eta025Adgangsareal"
];

for (const [group, fields] of Object.entries(requiredFields)) {
  for (const field of fields) {
    assert(
      querySource.includes(field),
      `${group}.${field} must be selected in Datafordeler query`
    );
    assert(
      mapperSource.includes(field),
      `${group}.${field} must be consumed by mapper`
    );
  }
}

for (const field of sourceUnavailableFields) {
  assert(
    !querySource.includes(field),
    `${field} must not be queried until Datafordeler exposes it`
  );
}

assert(
  sharedSource.includes("house_public_data_profile.v1"),
  "shared contract must expose the versioned public data profile"
);
assert(
  sharedSource.includes("source_unavailable"),
  "shared contract must expose availability semantics"
);

console.log(
  JSON.stringify({
    event: "check.bbr_public_data_parity_passed",
    requiredFieldCount: Object.values(requiredFields).flat().length,
    sourceUnavailableFieldCount: sourceUnavailableFields.length
  })
);
