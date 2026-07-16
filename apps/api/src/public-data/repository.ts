import { createHash } from "node:crypto";

import type { HousePublicDataResponseV1, SavedHouse } from "@matriva/shared";

import { ApiError, createOpaqueId, getSavedHouse, pool } from "../db.ts";
import { PUBLIC_DATA_CODEBOOK_VERSION } from "./codebooks.ts";
import {
  PUBLIC_DATA_MAPPING_VERSION,
  type DatafordelerRawPayload,
  type PublicDataNormalized,
  type PublicDataTarget
} from "./types.ts";

type HouseRow = {
  id: string;
  user_id: string;
  address_label: string;
  dawa_address_id: string | null;
  source_access_address_id: string | null;
  status: SavedHouse["status"];
  data_confidence: SavedHouse["dataConfidence"];
  created_at: Date;
  updated_at: Date;
};

function publicDataStatusCanBecomeCurrent(
  status: HousePublicDataResponseV1["status"]
) {
  return status === "success" || status === "partial" || status === "ambiguous";
}

function hashFailureReference(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function getPublicDataTargetForHouse(
  userId: string,
  houseId: string
): Promise<PublicDataTarget> {
  const result = await pool.query<HouseRow>(
    "select * from houses where id = $1 and user_id = $2",
    [houseId, userId]
  );
  const house = result.rows[0];

  if (!house) {
    throw new ApiError(404, "house_not_found", "Saved house was not found.");
  }

  if (!house.dawa_address_id) {
    throw new ApiError(
      409,
      "house_public_data_address_missing",
      "Saved house does not have a DAR address reference."
    );
  }

  return {
    kind: "house",
    id: house.id,
    userId,
    addressLabel: house.address_label,
    darAddressId: house.dawa_address_id,
    darAccessAddressId: house.source_access_address_id
  };
}

export async function getCurrentHousePublicData(
  userId: string,
  houseId: string
) {
  await getSavedHouse(userId, houseId);

  const result = await pool.query<{ normalized_payload: HousePublicDataResponseV1 }>(
    `
      select normalized_payload
      from house_public_data_snapshots
      where house_id = $1 and is_current
      limit 1
    `,
    [houseId]
  );
  const row = result.rows[0];

  if (!row) {
    return {
      contract: "house_public_data.v1",
      status: "not_started",
      source: {
        provider: "datafordeler",
        register: "bbr",
        fetchedAt: null,
        effectiveAt: null,
        mappingVersion: PUBLIC_DATA_MAPPING_VERSION,
        codebookVersion: PUBLIC_DATA_CODEBOOK_VERSION
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
    } satisfies HousePublicDataResponseV1;
  }

  return row.normalized_payload;
}

export async function saveHousePublicDataSnapshot(
  target: PublicDataTarget,
  rawPayload: DatafordelerRawPayload,
  normalized: PublicDataNormalized
) {
  const client = await pool.connect();
  const snapshotId = createOpaqueId("pubsnap");

  try {
    await client.query("begin");

    if (publicDataStatusCanBecomeCurrent(normalized.status)) {
      await client.query(
        `
          update house_public_data_snapshots
          set is_current = false
          where house_id = $1 and is_current
        `,
        [target.kind === "house" ? target.id : null]
      );
    }

    await client.query(
      `
        insert into house_public_data_snapshots (
          id,
          house_id,
          house_draft_id,
          provider,
          register,
          status,
          fetched_at,
          effective_at,
          mapping_version,
          codebook_version,
          raw_payload,
          raw_payload_hash,
          normalized_payload,
          is_current
        )
        values (
          $1, $2, $3, 'datafordeler', 'bbr', $4, $5, $6, $7, $8, $9::jsonb,
          $10, $11::jsonb, $12
        )
      `,
      [
        snapshotId,
        target.kind === "house" ? target.id : null,
        target.kind === "house_draft" ? target.id : null,
        normalized.status,
        normalized.source.fetchedAt,
        normalized.source.effectiveAt,
        normalized.source.mappingVersion,
        normalized.source.codebookVersion,
        JSON.stringify(rawPayload),
        normalized.rawPayloadHash,
        JSON.stringify(normalized),
        publicDataStatusCanBecomeCurrent(normalized.status)
      ]
    );

    for (const parcel of normalized.parcels) {
      await client.query(
        `
          insert into house_public_parcels (
            id,
            snapshot_id,
            cadastral_parcel_id,
            cadastral_number,
            owner_district_id,
            municipality_id,
            raw_normalized
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          createOpaqueId("pubpar"),
          snapshotId,
          parcel.cadastralParcelId,
          parcel.cadastralNumber,
          parcel.ownerDistrictId,
          parcel.municipalityId,
          JSON.stringify(parcel)
        ]
      );
    }

    for (const building of normalized.buildings) {
      const publicBuildingId = createOpaqueId("pubbld");

      await client.query(
        `
          insert into house_public_buildings (
            id,
            snapshot_id,
            house_id,
            bbr_building_id,
            building_number,
            is_address_building,
            included_in_product_view,
            exclusion_reason,
            lifecycle_code,
            use_code,
            construction_year,
            residential_area_m2,
            total_building_area_m2,
            raw_normalized
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
        `,
        [
          publicBuildingId,
          snapshotId,
          target.kind === "house" ? target.id : null,
          building.bbrBuildingId,
          building.number,
          building.isAddressBuilding,
          building.inclusion.includedInProductView,
          building.inclusion.exclusionReason,
          building.lifecycle.code,
          building.use?.code ?? null,
          building.constructionYear,
          building.areas.residentialAreaM2,
          building.areas.totalBuildingAreaM2,
          JSON.stringify(building)
        ]
      );

      for (const unit of building.units) {
        await client.query(
          `
            insert into house_public_units (
              id,
              snapshot_id,
              building_id,
              bbr_unit_id,
              bbr_building_id,
              bbr_floor_id,
              lifecycle_code,
              use_code,
              residential_area_m2,
              total_area_m2,
              room_count,
              raw_normalized
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
          `,
          [
            createOpaqueId("pubunt"),
            snapshotId,
            publicBuildingId,
            unit.bbrUnitId,
            building.bbrBuildingId,
            unit.floorId,
            unit.lifecycle.code,
            unit.use?.code ?? null,
            unit.areas.residentialAreaM2,
            unit.areas.totalAreaM2,
            unit.roomCount,
            JSON.stringify(unit)
          ]
        );
      }

      for (const floor of building.floors) {
        await client.query(
          `
            insert into house_public_floors (
              id,
              snapshot_id,
              building_id,
              bbr_floor_id,
              bbr_building_id,
              lifecycle_code,
              designation,
              total_floor_area_m2,
              basement_area_m2,
              legal_residential_basement_area_m2,
              raw_normalized
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
          `,
          [
            createOpaqueId("pubflr"),
            snapshotId,
            publicBuildingId,
            floor.bbrFloorId,
            building.bbrBuildingId,
            floor.lifecycle.code,
            floor.designation,
            floor.totalFloorAreaM2,
            floor.basementAreaM2,
            floor.legalResidentialBasementAreaM2,
            JSON.stringify(floor)
          ]
        );
      }
    }

    await client.query("commit");
    return normalized;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordHousePublicDataFailure(
  target: PublicDataTarget,
  status: "not_found" | "temporarily_unavailable" | "failed",
  providerErrorCode: string,
  providerErrorMessageSanitized: string
) {
  await pool.query(
    `
      insert into house_public_data_snapshots (
        id,
        house_id,
        house_draft_id,
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
        $1, $2, $3, 'datafordeler', 'bbr', $4, $5, $6, '{}'::jsonb, $7,
        $8::jsonb, $9, $10, false
      )
    `,
    [
      createOpaqueId("pubsnap"),
      target.kind === "house" ? target.id : null,
      target.kind === "house_draft" ? target.id : null,
      status,
      PUBLIC_DATA_MAPPING_VERSION,
      PUBLIC_DATA_CODEBOOK_VERSION,
      hashFailureReference(
        `${target.kind}:${target.id}:${Date.now()}:${providerErrorCode}`
      ),
      JSON.stringify({
        contract: "house_public_data.v1",
        status,
        source: {
          provider: "datafordeler",
          register: "bbr",
          fetchedAt: new Date().toISOString(),
          effectiveAt: null,
          mappingVersion: PUBLIC_DATA_MAPPING_VERSION,
          codebookVersion: PUBLIC_DATA_CODEBOOK_VERSION
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
        warnings: [
          {
            code:
              status === "not_found"
                ? "provider_not_found"
                : "provider_temporarily_unavailable",
            message: providerErrorMessageSanitized
          }
        ]
      } satisfies HousePublicDataResponseV1),
      providerErrorCode,
      providerErrorMessageSanitized
    ]
  );
}
