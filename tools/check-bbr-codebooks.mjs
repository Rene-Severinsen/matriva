import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const snapshot = JSON.parse(readFileSync(new URL("../apps/api/src/public-data/bbr-codebooks.snapshot.json", import.meta.url), "utf8"));
const codebookSource = readFileSync(new URL("../apps/api/src/public-data/codebooks.ts", import.meta.url), "utf8");
const mapperSource = readFileSync(new URL("../apps/api/src/public-data/mapper.ts", import.meta.url), "utf8");

assert.equal(snapshot.contract, "matriva_bbr_codebooks.v1");
const union = codebookSource.match(/export type CodebookKey\s*=\s*([\s\S]*?);/);
assert(union);
const declared = [...union[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const keys = Object.keys(snapshot.codebooks);
assert.deepEqual(declared, keys);

for (const key of keys) {
  const pattern = new RegExp(`const\\s+${key}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s+satisfies\\s+Record<string,\\s*CodebookEntry>;`);
  const match = codebookSource.match(pattern);
  assert(match, `Mangler codebook: ${key}`);
  const actual = [...match[1].matchAll(/"([^"]+)"\s*:\s*\{\s*label:/g)].map((m) => m[1]).sort();
  const expected = Object.keys(snapshot.codebooks[key].entries).sort();
  assert.deepEqual(actual, expected, `${key} afviger fra snapshot`);
  assert(expected.length > 0, `${key} er tom`);
}

assert.notDeepEqual(Object.keys(snapshot.codebooks.buildingUse.entries).sort(), Object.keys(snapshot.codebooks.unitUse.entries).sort());
for (const [key, expectedFields] of Object.entries(snapshot.fieldMappings)) {
  const callPattern = new RegExp(
    `lookupCode\\(\\s*"${key}"\\s*,\\s*([\\s\\S]*?)\\)`,
    "g"
  );
  const actualFields = [...mapperSource.matchAll(callPattern)].map((match) => {
    const argument = match[1].trim();
    const fieldMatch = argument.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    assert(fieldMatch, `${key}: kunne ikke udlede felt fra lookupCode-argument: ${argument}`);
    return fieldMatch[1];
  });
  assert.deepEqual(
    [...new Set(actualFields)].sort(),
    [...expectedFields].sort(),
    `${key} har forkert feltmapping`
  );
}
assert(snapshot.codebooks.buildingUse.entries["130"]?.label);
assert.equal(snapshot.codebooks.heatingInstallation.entries["5"]?.label, "Varmepumpe");
assert.equal(snapshot.codebooks.heatingSource.entries["1"]?.label, "Elektricitet");
console.log(JSON.stringify({event:"check.bbr_codebooks_passed",snapshotGeneratedOn:snapshot.generatedOn,codebookCount:keys.length,entryCount:keys.reduce((sum,key)=>sum+Object.keys(snapshot.codebooks[key].entries).length,0)}));
