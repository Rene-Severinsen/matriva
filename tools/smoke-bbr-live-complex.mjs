import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import pg from "pg";

const host = "127.0.0.1";
const port = "4104";
const baseUrl = `http://${host}:${port}`;
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://matriva:matriva_dev_password@127.0.0.1:56432/matriva_dev";
const startupTimeoutMs = 20_000;
const pollIntervalMs = 250;
const email = `bbr-complex-${Date.now()}@example.test`;
const address = {
  source: "DAWA",
  sourceAddressId: "0a3f50c9-8c5e-32b8-e044-0003ba298018",
  sourceAccessAddressId: "0a3f509b-eddb-32b8-e044-0003ba298018",
  label: "Rosenstien 10, 9300 Sæby"
};

function loadLocalEnv() {
  const envPath = resolve(".env");

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

if (!process.env.DATAFORDELER_API_KEY) {
  throw new Error(
    "smoke:bbr:live:complex requires DATAFORDELER_API_KEY in the local environment."
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function bearer(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

function startApi() {
  const child = spawn("npm", ["run", "dev:api"], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOST: host,
      PORT: port,
      MATRIVA_AUTH_DISABLE_LIMITS: "true"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stderrLog = "";
  child.stderr.on("data", (chunk) => {
    child.stderrLog += String(chunk);
  });
  return child;
}

function stopApi(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    child.kill("SIGTERM");
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function waitForHealth(child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("API exited before complex BBR smoke could run.");
    }

    try {
      const health = await request("/health");

      if (health.response.status === 200) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${baseUrl}/health.`);
}

function byNumber(buildings, number) {
  return buildings.find((building) => building.number === number);
}

function assertCodeLabel(value, code, label) {
  assert.equal(value?.code, code);
  assert.equal(value?.label, label);
  assert.equal(value?.known, true);
}

function assertNoApiKeyInPayloads(rows) {
  const apiKey = process.env.DATAFORDELER_API_KEY?.trim();

  if (!apiKey) {
    return;
  }

  for (const row of rows) {
    assert.equal(JSON.stringify(row).includes(apiKey), false);
  }
}

async function createSessionAndHouse() {
  const requested = await request("/v1/auth/magic-link/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  assert.equal(requested.response.status, 200);
  const token = new URL(requested.body.devMagicLink).searchParams.get("token");
  assert(token);

  const consumed = await request("/v1/auth/magic-link/consume", {
    method: "POST",
    body: JSON.stringify({ token })
  });
  assert.equal(consumed.response.status, 200);

  const profile = await request("/v1/me/profile", {
    method: "PUT",
    headers: bearer(consumed.body.tokens.accessToken),
    body: JSON.stringify({ displayName: "BBR Complex Smoke" })
  });
  assert.equal(profile.response.status, 200);

  const house = await request("/v1/houses", {
    method: "POST",
    headers: bearer(consumed.body.tokens.accessToken),
    body: JSON.stringify({ selectedAddress: address })
  });
  assert.equal(house.response.status, 201);

  return {
    accessToken: consumed.body.tokens.accessToken,
    userId: consumed.body.user.id,
    houseId: house.body.house.id
  };
}

async function verifyPersistence(pool, houseId) {
  const snapshots = await pool.query(
    `
      select
        id,
        status,
        is_current,
        raw_payload,
        normalized_payload,
        bfe_number,
        property_municipality_code,
        assessment_property_number,
        provider_error_code,
        provider_error_message_sanitized
      from house_public_data_snapshots
      where house_id = $1
      order by created_at asc
    `,
    [houseId]
  );
  const current = snapshots.rows.find((row) => row.is_current);
  assert(current, "successful refresh must create a current snapshot");
  assert(["success", "partial", "ambiguous"].includes(current.status));
  assert(current.raw_payload);
  assert(current.normalized_payload);
  assertNoApiKeyInPayloads(snapshots.rows);
  assert.equal(current.bfe_number, current.normalized_payload.property.bfeNumber);
  assert.equal(
    current.property_municipality_code,
    current.normalized_payload.property.municipalityCode
  );
  assert.equal(
    current.assessment_property_number,
    current.normalized_payload.property.assessmentPropertyNumber
  );

  const buildings = await pool.query(
    `
      select
        id,
        snapshot_id,
        bbr_building_id,
        use_code,
        construction_year,
        residential_area_m2,
        total_building_area_m2,
        footprint_area_m2,
        outer_wall_code,
        roof_code,
        heating_installation_code,
        heating_source_code,
        supplementary_heating_code,
        raw_normalized
      from house_public_buildings
      where snapshot_id = $1
    `,
    [current.id]
  );
  const units = await pool.query(
    `
      select
        id,
        snapshot_id,
        building_id,
        bbr_unit_id,
        use_code,
        housing_type_code,
        area_source_code,
        residential_area_m2,
        total_area_m2,
        room_count,
        bathroom_count,
        toilet_type_code,
        bath_type_code,
        address_function_code,
        kitchen_type_code
      from house_public_units
      where snapshot_id = $1
    `,
    [current.id]
  );
  const floors = await pool.query(
    `
      select
        id,
        snapshot_id,
        building_id,
        bbr_floor_id,
        designation,
        total_floor_area_m2,
        utilised_attic_area_m2,
        basement_area_m2,
        legal_residential_basement_area_m2,
        commercial_basement_area_m2
      from house_public_floors
      where snapshot_id = $1
    `,
    [current.id]
  );
  assert.equal(buildings.rowCount, 9);
  assert(units.rowCount >= 1);
  assert(floors.rowCount >= 2);
  assert(units.rows.every((unit) =>
    buildings.rows.some((building) => building.id === unit.building_id)
  ));
  assert(floors.rows.every((floor) =>
    buildings.rows.some((building) => building.id === floor.building_id)
  ));
  assert(buildings.rows.some((building) => building.footprint_area_m2 === 160));
  assert(units.rows.some((unit) => unit.bathroom_count === 1));

  const parcels = await pool.query(
    `
      select
        cadastral_parcel_id,
        cadastral_number,
        owner_district_id,
        municipality_id,
        raw_normalized
      from house_public_parcels
      where snapshot_id = $1
    `,
    [current.id]
  );
  assert.equal(parcels.rowCount, current.normalized_payload.parcels.length);

  const normalizedPrimaryBuilding = current.normalized_payload.buildings.find(
    (building) =>
      building.bbrBuildingId === current.normalized_payload.selection.primaryBuildingId
  );
  assert(normalizedPrimaryBuilding);
  const primaryBuildingRow = buildings.rows.find(
    (building) => building.bbr_building_id === normalizedPrimaryBuilding.bbrBuildingId
  );
  assert(primaryBuildingRow);
  assert.equal(primaryBuildingRow.use_code, normalizedPrimaryBuilding.use?.code ?? null);
  assert.equal(primaryBuildingRow.construction_year, normalizedPrimaryBuilding.constructionYear);
  assert.equal(primaryBuildingRow.residential_area_m2, normalizedPrimaryBuilding.areas.residentialAreaM2);
  assert.equal(primaryBuildingRow.total_building_area_m2, normalizedPrimaryBuilding.areas.totalBuildingAreaM2);
  assert.equal(primaryBuildingRow.footprint_area_m2, normalizedPrimaryBuilding.areas.footprintAreaM2);
  assert.equal(primaryBuildingRow.outer_wall_code, normalizedPrimaryBuilding.materials.outerWall?.code ?? null);
  assert.equal(primaryBuildingRow.roof_code, normalizedPrimaryBuilding.materials.roof?.code ?? null);
  assert.equal(primaryBuildingRow.heating_installation_code, normalizedPrimaryBuilding.heating.installation?.code ?? null);
  assert.equal(primaryBuildingRow.heating_source_code, normalizedPrimaryBuilding.heating.source?.code ?? null);
  assert.equal(primaryBuildingRow.supplementary_heating_code, normalizedPrimaryBuilding.heating.supplementary?.code ?? null);
  assert.deepEqual(primaryBuildingRow.raw_normalized, normalizedPrimaryBuilding);

  const normalizedPrimaryUnit = normalizedPrimaryBuilding.units.find(
    (unit) => unit.bbrUnitId === current.normalized_payload.selection.primaryUnitId
  );
  assert(normalizedPrimaryUnit);
  const primaryUnitRow = units.rows.find(
    (unit) => unit.bbr_unit_id === normalizedPrimaryUnit.bbrUnitId
  );
  assert(primaryUnitRow);
  assert.equal(primaryUnitRow.housing_type_code, normalizedPrimaryUnit.housingType?.code ?? null);
  assert.equal(primaryUnitRow.area_source_code, normalizedPrimaryUnit.areaSource?.code ?? null);
  assert.equal(primaryUnitRow.residential_area_m2, normalizedPrimaryUnit.areas.residentialAreaM2);
  assert.equal(primaryUnitRow.total_area_m2, normalizedPrimaryUnit.areas.totalAreaM2);
  assert.equal(primaryUnitRow.room_count, normalizedPrimaryUnit.roomCount);
  assert.equal(primaryUnitRow.bathroom_count, normalizedPrimaryUnit.facilities.bathroomCount);
  assert.equal(primaryUnitRow.toilet_type_code, normalizedPrimaryUnit.facilities.toiletType?.code ?? null);
  assert.equal(primaryUnitRow.bath_type_code, normalizedPrimaryUnit.facilities.bathType?.code ?? null);
  assert.equal(primaryUnitRow.kitchen_type_code, normalizedPrimaryUnit.facilities.kitchenType?.code ?? null);
  assert.equal(primaryUnitRow.address_function_code, normalizedPrimaryUnit.addressFunction?.code ?? null);

  const normalizedFloor = normalizedPrimaryBuilding.floors[0];
  const floorRow = floors.rows.find(
    (floor) => floor.bbr_floor_id === normalizedFloor.bbrFloorId
  );
  assert(floorRow);
  assert.equal(floorRow.designation, normalizedFloor.designation);
  assert.equal(floorRow.total_floor_area_m2, normalizedFloor.totalFloorAreaM2);
  assert.equal(floorRow.utilised_attic_area_m2, normalizedFloor.utilisedAtticAreaM2);
  assert.equal(floorRow.basement_area_m2, normalizedFloor.basementAreaM2);

  const normalizedParcel = current.normalized_payload.parcels[0];
  const parcelRow = parcels.rows.find(
    (parcel) => parcel.cadastral_parcel_id === normalizedParcel.cadastralParcelId
  );
  assert(parcelRow);
  assert.equal(parcelRow.cadastral_number, normalizedParcel.cadastralNumber);
  assert.equal(parcelRow.owner_district_id, normalizedParcel.ownerDistrictId);
  assert.equal(parcelRow.municipality_id, normalizedParcel.municipalityId);
  assert.deepEqual(parcelRow.raw_normalized, normalizedParcel);

  await pool.query(
    `
      insert into house_public_data_snapshots (
        id,
        house_id,
        provider,
        register,
        status,
        mapping_version,
        codebook_version,
        raw_payload,
        raw_payload_hash,
        normalized_payload,
        provider_error_code,
        provider_error_message_sanitized,
        is_current
      )
      values (
        $3,
        $1,
        'datafordeler',
        'bbr',
        'failed',
        'house_public_data_mapping.v1',
        '2026-07-16.v1',
        '{}'::jsonb,
        $4,
        $2::jsonb,
        'simulated_provider_failure',
        'Simulated provider failure.',
        false
      )
    `,
    [
      houseId,
      JSON.stringify({
        contract: "house_public_data.v1",
        status: "failed",
        source: {
          provider: "datafordeler",
          register: "bbr",
          fetchedAt: new Date().toISOString(),
          effectiveAt: null,
          mappingVersion: "house_public_data_mapping.v1",
          codebookVersion: "2026-07-16.v1"
        },
        selection: {
          primaryBuildingId: null,
          primaryBuildingStatus: "not_found",
          primaryUnitId: null,
          primaryUnitStatus: "not_found"
        },
        address: null,
        property: null,
        ground: null,
        parcels: [],
        buildings: [],
        productBuildings: [],
        warnings: []
      }),
      `pubsnap_complex_failure_${Date.now().toString(36)}`,
      `complex-failure-hash-${Date.now()}`
    ]
  );

  const currentAfterFailure = await pool.query(
    `
      select id
      from house_public_data_snapshots
      where house_id = $1 and is_current
    `,
    [houseId]
  );
  assert.equal(currentAfterFailure.rowCount, 1);
  assert.equal(currentAfterFailure.rows[0].id, current.id);

  return {
    snapshotId: current.id,
    sourceBuildingRows: buildings.rowCount,
    unitRows: units.rowCount,
    floorRows: floors.rowCount
  };
}

function verifyPublicData(publicData) {
  assert.equal(publicData.contract, "house_public_data.v1");
  assert.equal(publicData.profile.contract, "house_public_data_profile.v1");
  assert.equal(publicData.status, "success");
  assert.ok(publicData.status);
  assert.ok(publicData.source);
  assert.ok(publicData.selection);
  assert.ok(publicData.address);
  assert.ok(publicData.property);
  assert.ok(publicData.ground);
  assert.ok(Array.isArray(publicData.parcels));
  assert.ok(Array.isArray(publicData.buildings));
  assert.ok(Array.isArray(publicData.productBuildings));
  assert.ok(Array.isArray(publicData.warnings));
  assert.equal("raw_payload" in publicData, false);
  assert.equal("rawPayload" in publicData, false);
  assert.equal("raw_payload" in publicData.profile, false);

  assert.equal(publicData.address.darAddressId, address.sourceAddressId);
  assert.equal(publicData.selection.primaryBuildingId, "4600cb6a-4f3c-4cb2-872a-3ecb746cf866");
  assert.equal(publicData.selection.primaryBuildingStatus, "automatic_address_relation");
  assert.equal(publicData.selection.primaryUnitStatus, "automatic_unambiguous");
  assert.equal(publicData.ground.bbrGroundId, "90a31dae-fa35-43ee-9fc5-462029630500");
  assert.equal(publicData.property.bfeNumber, "5537536");
  assert.equal(publicData.buildings.length, 9);
  assert.equal(publicData.productBuildings.length, 6);
  assert.equal(
    publicData.profile.sections.some((section) => section.key === "projectedBuildings"),
    true
  );
  assert.equal(publicData.profile.topFacts.some((fact) => fact.key === "heating"), true);
  assert.equal(publicData.buildings.filter((building) => building.lifecycle.code === "2").length, 3);
  assert.equal(publicData.productBuildings.some((building) => building.lifecycle.code === "2"), false);

  const expected = [
    [1, "120", 1970, 160],
    [2, "910", 1976, 33],
    [3, "950", 1999, 6],
    [4, "930", 1999, 5],
    [5, "930", 2010, 8],
    [6, "940", 2018, 5]
  ];

  for (const [number, use, year, footprint] of expected) {
    const building = byNumber(publicData.productBuildings, number);
    assert(building, `Product building ${number} must exist.`);
    assert.equal(building.use?.code, use);
    assert.equal(building.constructionYear, year);
    assert.equal(building.areas.footprintAreaM2, footprint);
  }

  const primaryBuilding = publicData.buildings.find(
    (building) => building.bbrBuildingId === publicData.selection.primaryBuildingId
  );
  assert(primaryBuilding);
  const primaryUnit = primaryBuilding.units.find(
    (unit) => unit.bbrUnitId === publicData.selection.primaryUnitId
  );
  assert(primaryUnit);
  assert.equal(primaryUnit.areas.residentialAreaM2, 160);
  assert.equal(primaryUnit.roomCount, 6);
  assert.equal(primaryUnit.facilities.bathroomCount, 1);
  assert.equal(primaryUnit.facilities.flushToiletCount, null);
  assert.equal(
    publicData.warnings.some(
      (warning) => warning.code === "optional_field_unavailable"
    ),
    true
  );

  const floors = primaryBuilding.floors;
  assert.equal(floors.length, 2);
  assert.deepEqual(
    floors.map((floor) => floor.designation).sort(),
    ["kl", "st"]
  );
  const basement = floors.find((floor) => floor.designation === "kl");
  assert.equal(basement?.basementAreaM2, 80);
  assert.equal(basement?.legalResidentialBasementAreaM2, null);

  assert.equal(primaryBuilding.heating.installation?.code, "1");
  assert.equal(primaryBuilding.heating.source, null);
  assert.equal(primaryBuilding.heating.supplementary?.code, "2");

  assertCodeLabel(byNumber(publicData.productBuildings, 1)?.use, "120", "Fritliggende enfamiliehus");
  assertCodeLabel(byNumber(publicData.productBuildings, 2)?.use, "910", "Garage");
  assertCodeLabel(byNumber(publicData.productBuildings, 4)?.use, "930", "Udhus");
  assertCodeLabel(byNumber(publicData.productBuildings, 6)?.use, "940", "Drivhus");
  assertCodeLabel(byNumber(publicData.productBuildings, 3)?.use, "950", "Fritliggende overdækning");
  assertCodeLabel(publicData.buildings.find((building) => building.lifecycle.code === "2")?.lifecycle, "2", "Projekteret");
  assertCodeLabel(primaryBuilding.lifecycle, "6", "Opført");
  assertCodeLabel(primaryBuilding.heating.installation, "1", "Fjernvarme/blokvarme");
  assertCodeLabel(primaryBuilding.heating.supplementary, "2", "Brændeovn eller lignende med skorsten");

  return {
    status: publicData.status,
    sourceBuildingCount: publicData.buildings.length,
    productBuildingCount: publicData.productBuildings.length,
    primaryUnit: {
      residentialAreaM2: primaryUnit.areas.residentialAreaM2,
      roomCount: primaryUnit.roomCount,
      flushToiletCount: primaryUnit.facilities.flushToiletCount,
      bathroomCount: primaryUnit.facilities.bathroomCount
    },
    floors: floors.map((floor) => ({
      designation: floor.designation,
      basementAreaM2: floor.basementAreaM2,
      legalResidentialBasementAreaM2: floor.legalResidentialBasementAreaM2
    })),
    heating: {
      installation: primaryBuilding.heating.installation?.code ?? null,
      source: primaryBuilding.heating.source?.code ?? null,
      supplementary: primaryBuilding.heating.supplementary?.code ?? null
    },
    flushToiletCountVerified: primaryUnit.facilities.flushToiletCount === 2
  };
}

const child = startApi();
const pool = new pg.Pool({ connectionString: databaseUrl });
let userId;

try {
  await waitForHealth(child);
  const session = await createSessionAndHouse();
  userId = session.userId;

  const refreshed = await request(`/v1/houses/${session.houseId}/public-data/refresh`, {
    method: "POST",
    headers: bearer(session.accessToken)
  });
  if (refreshed.response.status !== 200) {
    console.error(
      JSON.stringify({
        event: "smoke.bbr.live_complex_refresh_failed",
        status: refreshed.response.status,
        body: refreshed.body
      })
    );
    if (child.stderrLog) {
      console.error(
        JSON.stringify({
          event: "smoke.bbr.live_complex_api_stderr",
          stderr: child.stderrLog
            .replace(/apiKey=[^&\s]+/g, "apiKey=[redacted]")
            .slice(-4000)
        })
      );
    }
  }
  assert.equal(refreshed.response.status, 200);
  const refreshSummary = verifyPublicData(refreshed.body);

  const persistence = await verifyPersistence(pool, session.houseId);

  const current = await request(`/v1/houses/${session.houseId}/public-data`, {
    headers: bearer(session.accessToken)
  });
  assert.equal(current.response.status, 200);
  const currentSummary = verifyPublicData(current.body);

  console.log(
    JSON.stringify({
      event: "smoke.bbr.live_complex_passed",
      address: address.label,
      status: currentSummary.status,
      sourceBuildingCount: currentSummary.sourceBuildingCount,
      productBuildingCount: currentSummary.productBuildingCount,
      primaryUnit: currentSummary.primaryUnit,
      floors: currentSummary.floors,
      heating: currentSummary.heating,
      persistence,
      apiContractVerified: true,
      rawPayloadReturnedByApi: false,
      flushToiletCountVerified: currentSummary.flushToiletCountVerified,
      warnings: current.body.warnings.map((warning) => warning.code),
      note:
        currentSummary.primaryUnit.flushToiletCount === null
          ? "Datafordeler GraphQL did not expose the validated flush toilet count field through the accepted BBR_Enhed schema."
          : undefined,
      refreshStatus: refreshSummary.status
    })
  );
} finally {
  if (userId) {
    await pool.query("delete from users where id = $1", [userId]);
  }

  await pool.end();
  stopApi(child);
}
