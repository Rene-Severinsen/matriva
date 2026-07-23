import {
  adminRecommendationCatalogItemResponseSchema,
  adminRecommendationCatalogResponseSchema,
  type AdminRecommendationCatalogItemResponse,
  type AdminRecommendationCatalogResponse
} from "@matriva/shared";

import { ApiError, pool } from "./db.ts";

const sortColumns = {
  catalog_key: "catalog_key",
  title: "title",
  category: "category",
  active: "active",
  priority: "priority",
  instance_count: "instance_count",
  accepted_count: "accepted_count",
  permanent_hide_count: "permanent_hide_count",
  acceptance_rate: "acceptance_rate"
} as const;

function count(value: unknown) {
  return Number(value ?? 0);
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function parseListQuery(params: URLSearchParams) {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "25", 10);
  const sort = params.get("sort") ?? "catalog_key";
  const order = params.get("order") ?? "asc";
  const active = params.get("active") ?? "all";
  const category = params.get("category")?.trim() ?? "";
  const query = params.get("query")?.trim() ?? "";

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(
      400,
      "admin_recommendations_page_invalid",
      "Page must be positive."
    );
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiError(
      400,
      "admin_recommendations_page_size_invalid",
      "Page size must be between 1 and 100."
    );
  }

  if (!(sort in sortColumns)) {
    throw new ApiError(
      400,
      "admin_recommendations_sort_invalid",
      "Unsupported recommendation sort."
    );
  }

  if (order !== "asc" && order !== "desc") {
    throw new ApiError(
      400,
      "admin_recommendations_order_invalid",
      "Unsupported sort order."
    );
  }

  if (active !== "all" && active !== "active" && active !== "inactive") {
    throw new ApiError(
      400,
      "admin_recommendations_active_invalid",
      "Active filter must be all, active, or inactive."
    );
  }

  return {
    page,
    pageSize,
    sort: sort as keyof typeof sortColumns,
    order,
    active,
    category,
    query
  };
}

function filters(query: string, active: string, category: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (query.length > 0) {
    values.push(`%${query.toLowerCase()}%`);
    clauses.push(`(
      catalog_key ilike $${values.length}
      or title ilike $${values.length}
      or short_description ilike $${values.length}
    )`);
  }

  if (active !== "all") {
    values.push(active === "active");
    clauses.push(`active = $${values.length}`);
  }

  if (category.length > 0 && category !== "all") {
    values.push(category);
    clauses.push(`category = $${values.length}`);
  }

  return {
    sql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
    values
  };
}

function mapCatalogItem(row: Record<string, any>) {
  const instanceCount = count(row.instance_count);
  const acceptedCount = count(row.accepted_count);
  const permanentHideCount = count(row.permanent_hide_count);

  return {
    catalogKey: row.catalog_key,
    catalogVersion: row.catalog_version,
    title: row.title,
    category: row.category,
    active: row.active,
    priority: row.priority,
    recurrenceInterval: row.recurrence_interval,
    season: row.season,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    instanceCount,
    pendingCount: count(row.pending_count),
    acceptedCount,
    dismissedCount: count(row.dismissed_count),
    acceptedTaskCount: count(row.accepted_task_count),
    permanentHideCount,
    acceptanceRate: ratio(acceptedCount, instanceCount),
    hideRate: ratio(permanentHideCount, instanceCount + permanentHideCount)
  };
}

const catalogStatsSql = `
  with catalog_rows as (
    select
      mci.catalog_key,
      mci.catalog_version,
      mci.title,
      mci.short_description,
      mci.component_key as category,
      mci.component_key,
      mci.season,
      mci.recommended_period,
      mci.default_recurrence_interval as recurrence_interval,
      mci.priority,
      mci.eligibility_rules,
      mci.disclaimer_class,
      mci.is_active as active,
      mci.created_at,
      mci.updated_at,
      count(mr.id)::int as instance_count,
      count(mr.id) filter (where mr.status = 'pending')::int as pending_count,
      count(mr.id) filter (where mr.status = 'accepted')::int as accepted_count,
      count(mr.id) filter (where mr.status = 'dismissed')::int as dismissed_count,
      count(mr.accepted_task_id)::int as accepted_task_count,
      count(distinct mr.house_id)::int as distinct_house_count,
      count(distinct mr.user_id)::int as distinct_user_count,
      (
        select count(*)::int
        from maintenance_recommendation_hides mh
        where mh.catalog_key = mci.catalog_key and mh.unhidden_at is null
      ) as permanent_hide_count
    from maintenance_catalog_items mci
    left join maintenance_recommendations mr
      on mr.catalog_key = mci.catalog_key
      and mr.catalog_version = mci.catalog_version
    group by mci.id
  )
`;

export async function listAdminRecommendationCatalog(
  params: URLSearchParams
): Promise<AdminRecommendationCatalogResponse> {
  const parsed = parseListQuery(params);
  const offset = (parsed.page - 1) * parsed.pageSize;
  const where = filters(parsed.query, parsed.active, parsed.category);
  const values = [...where.values, parsed.pageSize, offset];
  const [result, categories] = await Promise.all([
    pool.query(
      `
        ${catalogStatsSql},
        filtered as (
          select
            *,
            case when instance_count = 0 then 0 else accepted_count::float / instance_count end as acceptance_rate,
            count(*) over()::int as total_count
          from catalog_rows
          ${where.sql}
        )
        select *
        from filtered
        order by ${sortColumns[parsed.sort]} ${parsed.order}, catalog_key asc, catalog_version asc
        limit $${values.length - 1}
        offset $${values.length}
      `,
      values
    ),
    pool.query(
      "select distinct component_key as category from maintenance_catalog_items order by component_key"
    )
  ]);
  const total = count(result.rows[0]?.total_count);

  return adminRecommendationCatalogResponseSchema.parse({
    items: result.rows.map(mapCatalogItem),
    filters: {
      categories: categories.rows.map((row) => row.category)
    },
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      pageCount: Math.ceil(total / parsed.pageSize)
    },
    generatedAt: new Date().toISOString()
  });
}

export async function getAdminRecommendationCatalogItem(
  catalogKey: string
): Promise<AdminRecommendationCatalogItemResponse> {
  const result = await pool.query(
    `
      ${catalogStatsSql}
      select *
      from catalog_rows
      where catalog_key = $1
      order by active desc, updated_at desc, catalog_version desc
      limit 1
    `,
    [catalogKey]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(
      404,
      "admin_recommendation_catalog_not_found",
      "Recommendation catalog item was not found."
    );
  }

  const acceptedSeries = await pool.query(
    `
      with buckets as (
        select generate_series(
          date_trunc('month', (now() - interval '11 months') at time zone 'UTC'),
          date_trunc('month', now() at time zone 'UTC'),
          interval '1 month'
        ) as bucket_start
      ),
      accepted as (
        select
          date_trunc('month', updated_at at time zone 'UTC') as bucket_start,
          count(*)::int as value
        from maintenance_recommendations
        where catalog_key = $1 and status = 'accepted'
        group by 1
      )
      select
        buckets.bucket_start at time zone 'UTC' as bucket_start,
        coalesce(accepted.value, 0)::int as value
      from buckets
      left join accepted using (bucket_start)
      order by buckets.bucket_start
    `,
    [catalogKey]
  );

  const item = mapCatalogItem(row);

  return adminRecommendationCatalogItemResponseSchema.parse({
    item: {
      ...item,
      shortDescription: row.short_description,
      componentKey: row.component_key,
      recommendedPeriod: row.recommended_period,
      eligibilityRules: row.eligibility_rules,
      disclaimerClass: row.disclaimer_class,
      lineage: {
        catalogKey: row.catalog_key,
        catalogVersion: row.catalog_version
      },
      statusDistribution: {
        pending: item.pendingCount,
        accepted: item.acceptedCount,
        dismissed: item.dismissedCount
      },
      distinctHouseCount: count(row.distinct_house_count),
      distinctUserCount: count(row.distinct_user_count),
      acceptedOverTime: acceptedSeries.rows.map((point) => ({
        bucketStart: point.bucket_start.toISOString(),
        value: count(point.value)
      })),
      dataQuality: {
        acceptedOverTime: "estimated_from_updated_at",
        notNow: "not_available"
      }
    },
    generatedAt: new Date().toISOString()
  });
}
