import {
  adminHouseResponseSchema,
  adminHousesResponseSchema,
  type AdminHouseResponse,
  type AdminHousesResponse
} from "@matriva/shared";

import { ApiError, pool } from "./db.ts";

const sortColumns = {
  created_at: "created_at",
  address: "address_label",
  owner: "email",
  public_data_status: "public_data_status",
  warning_count: "warning_count",
  task_count: "task_count",
  completion_count: "completion_count",
  active_recommendation_count: "active_recommendation_count",
  latest_activity_at: "latest_activity_at"
} as const;

function count(value: unknown) {
  return Number(value ?? 0);
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function warningCount(normalizedPayload: any) {
  return Array.isArray(normalizedPayload?.warnings)
    ? normalizedPayload.warnings.length
    : 0;
}

function parseListQuery(params: URLSearchParams) {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "25", 10);
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";
  const publicDataStatus = params.get("publicDataStatus") ?? "all";
  const query = params.get("query")?.trim() ?? "";
  const statuses = new Set([
    "all",
    "not_started",
    "fetching",
    "success",
    "partial",
    "not_found",
    "ambiguous",
    "temporarily_unavailable",
    "failed",
    "with_warnings"
  ]);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "admin_houses_page_invalid", "Page must be positive.");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiError(
      400,
      "admin_houses_page_size_invalid",
      "Page size must be between 1 and 100."
    );
  }

  if (!(sort in sortColumns)) {
    throw new ApiError(400, "admin_houses_sort_invalid", "Unsupported house sort.");
  }

  if (order !== "asc" && order !== "desc") {
    throw new ApiError(400, "admin_houses_order_invalid", "Unsupported sort order.");
  }

  if (!statuses.has(publicDataStatus)) {
    throw new ApiError(
      400,
      "admin_houses_public_data_status_invalid",
      "Unsupported public-data status filter."
    );
  }

  return {
    page,
    pageSize,
    sort: sort as keyof typeof sortColumns,
    order,
    publicDataStatus,
    query
  };
}

function mapHouse(row: Record<string, any>) {
  return {
    id: row.id,
    addressLabel: row.address_label,
    owner: {
      id: row.user_id,
      displayName: row.display_name,
      email: row.email
    },
    status: row.status,
    dataConfidence: row.data_confidence,
    createdAt: row.created_at.toISOString(),
    publicDataStatus: row.public_data_status,
    warningCount: count(row.warning_count),
    taskCount: count(row.task_count),
    completionCount: count(row.completion_count),
    activeRecommendationCount: count(row.active_recommendation_count),
    latestActivityAt: iso(row.latest_activity_at)
  };
}

function filters(query: string, publicDataStatus: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (query.length > 0) {
    values.push(`%${query.toLowerCase()}%`);
    clauses.push(`(
      h.address_label ilike $${values.length}
      or h.id ilike $${values.length}
      or u.email ilike $${values.length}
      or up.display_name ilike $${values.length}
    )`);
  }

  if (publicDataStatus === "with_warnings") {
    clauses.push("coalesce(jsonb_array_length(s.normalized_payload->'warnings'), 0) > 0");
  } else if (publicDataStatus !== "all") {
    values.push(publicDataStatus);
    clauses.push("coalesce(s.status, 'not_started') = $" + values.length);
  }

  return {
    sql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
    values
  };
}

export async function listAdminHouses(
  params: URLSearchParams
): Promise<AdminHousesResponse> {
  const parsed = parseListQuery(params);
  const offset = (parsed.page - 1) * parsed.pageSize;
  const where = filters(parsed.query, parsed.publicDataStatus);
  const values = [...where.values, parsed.pageSize, offset];
  const result = await pool.query(
    `
      with house_counts as (
        select
          h.id,
          count(distinct mt.id)::int as task_count,
          count(distinct mc.id)::int as completion_count,
          count(distinct mr.id) filter (where mr.status = 'pending')::int as active_recommendation_count,
          greatest(max(mt.updated_at), max(mc.created_at), max(mr.updated_at), h.updated_at) as latest_activity_at
        from houses h
        left join maintenance_tasks mt on mt.house_id = h.id and mt.deleted_at is null
        left join maintenance_completions mc on mc.house_id = h.id
        left join maintenance_recommendations mr on mr.house_id = h.id
        group by h.id
      ),
      filtered as (
        select
          h.*,
          u.email,
          up.display_name,
          coalesce(s.status, 'not_started') as public_data_status,
          coalesce(jsonb_array_length(s.normalized_payload->'warnings'), 0)::int as warning_count,
          hc.task_count,
          hc.completion_count,
          hc.active_recommendation_count,
          hc.latest_activity_at,
          count(*) over()::int as total_count
        from houses h
        join users u on u.id = h.user_id
        left join user_profiles up on up.user_id = u.id
        join house_counts hc on hc.id = h.id
        left join house_public_data_snapshots s on s.house_id = h.id and s.is_current
        ${where.sql}
      )
      select *
      from filtered h
      order by ${sortColumns[parsed.sort]} ${parsed.order}, id asc
      limit $${values.length - 1}
      offset $${values.length}
    `,
    values
  );
  const total = count(result.rows[0]?.total_count);

  return adminHousesResponseSchema.parse({
    houses: result.rows.map(mapHouse),
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      pageCount: Math.ceil(total / parsed.pageSize)
    },
    generatedAt: new Date().toISOString()
  });
}

export async function getAdminHouse(houseId: string): Promise<AdminHouseResponse> {
  const result = await pool.query(
    `
      with house_counts as (
        select
          h.id,
          count(distinct mt.id)::int as task_count,
          count(distinct mc.id)::int as completion_count,
          count(distinct mr.id) filter (where mr.status = 'pending')::int as active_recommendation_count,
          greatest(max(mt.updated_at), max(mc.created_at), max(mr.updated_at), h.updated_at) as latest_activity_at
        from houses h
        left join maintenance_tasks mt on mt.house_id = h.id and mt.deleted_at is null
        left join maintenance_completions mc on mc.house_id = h.id
        left join maintenance_recommendations mr on mr.house_id = h.id
        where h.id = $1
        group by h.id
      )
      select
        h.*,
        u.email,
        up.display_name,
        coalesce(s.status, 'not_started') as public_data_status,
        s.provider,
        s.register,
        s.fetched_at,
        s.effective_at,
        s.mapping_version,
        s.codebook_version,
        s.normalized_payload,
        hc.task_count,
        hc.completion_count,
        hc.active_recommendation_count,
        hc.latest_activity_at
      from houses h
      join users u on u.id = h.user_id
      left join user_profiles up on up.user_id = u.id
      join house_counts hc on hc.id = h.id
      left join house_public_data_snapshots s on s.house_id = h.id and s.is_current
      where h.id = $1
    `,
    [houseId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "admin_house_not_found", "Admin house was not found.");
  }

  const [buildings, units, floors, parcels, tasks, completions, recs, assets] =
    await Promise.all([
      pool.query(
        `
          select
            id,
            bbr_building_id,
            building_number,
            included_in_product_view,
            lifecycle_code,
            use_code,
            construction_year,
            residential_area_m2,
            total_building_area_m2
          from house_public_buildings
          where house_id = $1
          order by included_in_product_view desc, building_number nulls last, bbr_building_id
          limit 25
        `,
        [houseId]
      ),
      pool.query("select count(*)::int as count from house_public_units where snapshot_id in (select id from house_public_data_snapshots where house_id = $1 and is_current)", [houseId]),
      pool.query("select count(*)::int as count from house_public_floors where snapshot_id in (select id from house_public_data_snapshots where house_id = $1 and is_current)", [houseId]),
      pool.query("select count(*)::int as count from house_public_parcels where snapshot_id in (select id from house_public_data_snapshots where house_id = $1 and is_current)", [houseId]),
      pool.query(
        `
          select
            count(*)::int as total,
            count(*) filter (where status = 'planned')::int as planned,
            count(*) filter (where status = 'due')::int as due,
            count(*) filter (where status = 'overdue')::int as overdue,
            count(*) filter (where status = 'done')::int as done
          from maintenance_tasks
          where house_id = $1 and deleted_at is null
        `,
        [houseId]
      ),
      pool.query(
        "select count(*)::int as total, max(created_at) as latest_completed_at from maintenance_completions where house_id = $1",
        [houseId]
      ),
      pool.query(
        `
          select
            count(mr.*)::int as total,
            count(mr.*) filter (where mr.status = 'pending')::int as pending,
            count(mr.*) filter (where mr.status = 'accepted')::int as accepted,
            count(mr.*) filter (where mr.status = 'dismissed')::int as dismissed,
            count(mr.*) filter (where mr.status = 'pending')::int as active,
            (select count(*)::int from maintenance_recommendation_hides where house_id = $1 and unhidden_at is null) as permanent_hidden
          from maintenance_recommendations mr
          where mr.house_id = $1
        `,
        [houseId]
      ),
      pool.query(
        `
          select
            (select count(*)::int from house_documents where house_id = $1 and archived_at is null) as documents,
            (select count(*)::int from house_improvements where house_id = $1) as improvements,
            (select count(*)::int from house_media where house_id = $1) as media
        `,
        [houseId]
      )
    ]);

  const task = tasks.rows[0] ?? {};
  const completion = completions.rows[0] ?? {};
  const rec = recs.rows[0] ?? {};
  const asset = assets.rows[0] ?? {};
  const normalizedPayload = row.normalized_payload;

  return adminHouseResponseSchema.parse({
    house: {
      ...mapHouse({
        ...row,
        warning_count: warningCount(normalizedPayload)
      }),
      updatedAt: row.updated_at.toISOString(),
      sourceReferences: {
        dawaAddressId: row.dawa_address_id,
        sourceAccessAddressId: row.source_access_address_id
      },
      bbr: {
        source: {
          provider: row.provider,
          register: row.register,
          fetchedAt: iso(row.fetched_at),
          effectiveAt: iso(row.effective_at),
          mappingVersion: row.mapping_version,
          codebookVersion: row.codebook_version
        },
        summary: normalizedPayload
          ? {
              contract: "house_public_data_summary.v1",
              houseId,
              status: row.public_data_status,
              sourceLabel: "Registreret i BBR",
              fetchedAt: iso(row.fetched_at),
              primary: {
                bbrBuildingId:
                  normalizedPayload?.selection?.primaryBuildingId ?? null,
                title: normalizedPayload?.address?.label ?? row.address_label,
                values: []
              },
              otherBuildings: [],
              existingOtherBuildingCount: Math.max(0, buildings.rows.length - 1),
              projectedBuildingCount: buildings.rows.length,
              missingDataNotice: null,
              warnings: normalizedPayload?.warnings ?? []
            }
          : null,
        warnings: normalizedPayload?.warnings ?? [],
        buildings: buildings.rows.map((building) => ({
          id: building.id,
          bbrBuildingId: building.bbr_building_id,
          buildingNumber: building.building_number,
          includedInProductView: building.included_in_product_view,
          lifecycleCode: building.lifecycle_code,
          useCode: building.use_code,
          constructionYear: building.construction_year,
          residentialAreaM2: building.residential_area_m2,
          totalBuildingAreaM2: building.total_building_area_m2
        })),
        unitCount: count(units.rows[0]?.count),
        floorCount: count(floors.rows[0]?.count),
        parcelCount: count(parcels.rows[0]?.count)
      },
      taskSummary: {
        total: count(task.total),
        planned: count(task.planned),
        due: count(task.due),
        overdue: count(task.overdue),
        done: count(task.done)
      },
      completionSummary: {
        total: count(completion.total),
        latestCompletedAt: iso(completion.latest_completed_at)
      },
      recommendationSummary: {
        total: count(rec.total),
        pending: count(rec.pending),
        accepted: count(rec.accepted),
        dismissed: count(rec.dismissed),
        active: count(rec.active),
        permanentHidden: count(rec.permanent_hidden)
      },
      assetCounts: {
        documents: count(asset.documents),
        improvements: count(asset.improvements),
        media: count(asset.media)
      }
    },
    generatedAt: new Date().toISOString()
  });
}
