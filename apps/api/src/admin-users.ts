import {
  adminUserResponseSchema,
  adminUsersResponseSchema,
  type AdminUserResponse,
  type AdminUsersResponse
} from "@matriva/shared";

import { ApiError, pool } from "./db.ts";

const sortColumns = {
  created_at: "created_at",
  last_login_at: "last_login_at",
  latest_session_activity: "latest_session_activity_at",
  email: "email",
  display_name: "display_name",
  house_count: "house_count",
  task_count: "task_count",
  completion_count: "completion_count"
} as const;

function count(value: unknown) {
  return Number(value ?? 0);
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function parseListQuery(params: URLSearchParams) {
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(params.get("pageSize") ?? "25", 10);
  const sort = params.get("sort") ?? "created_at";
  const order = params.get("order") ?? "desc";
  const status = params.get("status") ?? "all";
  const query = params.get("query")?.trim() ?? "";

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "admin_users_page_invalid", "Page must be positive.");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiError(
      400,
      "admin_users_page_size_invalid",
      "Page size must be between 1 and 100."
    );
  }

  if (!(sort in sortColumns)) {
    throw new ApiError(400, "admin_users_sort_invalid", "Unsupported user sort.");
  }

  if (order !== "asc" && order !== "desc") {
    throw new ApiError(400, "admin_users_order_invalid", "Unsupported sort order.");
  }

  if (status !== "all" && status !== "active" && status !== "disabled") {
    throw new ApiError(
      400,
      "admin_users_status_invalid",
      "User status filter must be all, active, or disabled."
    );
  }

  return {
    page,
    pageSize,
    sort: sort as keyof typeof sortColumns,
    order,
    status,
    query
  };
}

function mapUser(row: Record<string, any>) {
  const houseCount = count(row.house_count);
  const hasProfile = row.display_name !== null;
  const onboardingState = !hasProfile
    ? "profile_required"
    : houseCount > 0
      ? "complete"
      : "house_required";

  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: iso(row.last_login_at),
    latestSessionActivityAt: iso(row.latest_session_activity_at),
    houseCount,
    taskCount: count(row.task_count),
    completionCount: count(row.completion_count),
    roles: row.roles ?? [],
    onboardingState
  };
}

function whereClause(query: string, status: string) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (status !== "all") {
    values.push(status);
    clauses.push(`u.status = $${values.length}`);
  }

  if (query.length > 0) {
    values.push(`%${query.toLowerCase()}%`);
    clauses.push(`(
      u.email ilike $${values.length}
      or up.display_name ilike $${values.length}
      or u.id ilike $${values.length}
    )`);
  }

  return {
    sql: clauses.length > 0 ? `where ${clauses.join(" and ")}` : "",
    values
  };
}

export async function listAdminUsers(
  params: URLSearchParams
): Promise<AdminUsersResponse> {
  const parsed = parseListQuery(params);
  const offset = (parsed.page - 1) * parsed.pageSize;
  const where = whereClause(parsed.query, parsed.status);
  const values = [...where.values, parsed.pageSize, offset];
  const result = await pool.query(
    `
      with user_counts as (
        select
          u.id,
          count(distinct h.id)::int as house_count,
          count(distinct mt.id)::int as task_count,
          count(distinct mc.id)::int as completion_count,
          max(s.last_used_at) as latest_session_activity_at,
          coalesce(
            array_remove(array_agg(distinct ur.role order by ur.role), null),
            '{}'
          ) as roles
        from users u
        left join houses h on h.user_id = u.id
        left join maintenance_tasks mt on mt.user_id = u.id and mt.deleted_at is null
        left join maintenance_completions mc on mc.user_id = u.id
        left join auth_sessions s on s.user_id = u.id
        left join user_roles ur on ur.user_id = u.id
        group by u.id
      ),
      filtered as (
        select
          u.id,
          u.email,
          u.status,
          u.created_at,
          u.last_login_at,
          up.display_name,
          uc.house_count,
          uc.task_count,
          uc.completion_count,
          uc.latest_session_activity_at,
          uc.roles,
          count(*) over()::int as total_count
        from users u
        join user_counts uc on uc.id = u.id
        left join user_profiles up on up.user_id = u.id
        ${where.sql}
      )
      select *
      from filtered
      order by ${sortColumns[parsed.sort]} ${parsed.order}, id asc
      limit $${values.length - 1}
      offset $${values.length}
    `,
    values
  );
  const total = count(result.rows[0]?.total_count);

  return adminUsersResponseSchema.parse({
    users: result.rows.map(mapUser),
    pagination: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      pageCount: Math.ceil(total / parsed.pageSize)
    },
    generatedAt: new Date().toISOString()
  });
}

export async function getAdminUser(userId: string): Promise<AdminUserResponse> {
  const result = await pool.query(
    `
      with user_counts as (
        select
          u.id,
          count(distinct h.id)::int as house_count,
          count(distinct mt.id)::int as task_count,
          count(distinct mc.id)::int as completion_count,
          max(s.last_used_at) as latest_session_activity_at,
          coalesce(array_remove(array_agg(distinct ur.role order by ur.role), null), '{}') as roles
        from users u
        left join houses h on h.user_id = u.id
        left join maintenance_tasks mt on mt.user_id = u.id and mt.deleted_at is null
        left join maintenance_completions mc on mc.user_id = u.id
        left join auth_sessions s on s.user_id = u.id
        left join user_roles ur on ur.user_id = u.id
        where u.id = $1
        group by u.id
      )
      select
        u.*,
        up.display_name,
        uc.house_count,
        uc.task_count,
        uc.completion_count,
        uc.latest_session_activity_at,
        uc.roles
      from users u
      join user_counts uc on uc.id = u.id
      left join user_profiles up on up.user_id = u.id
      where u.id = $1
    `,
    [userId]
  );
  const row = result.rows[0];

  if (!row) {
    throw new ApiError(404, "admin_user_not_found", "Admin user was not found.");
  }

  const [houses, taskSummary, completionSummary, recommendationSummary] =
    await Promise.all([
      pool.query(
        `
          select id, address_label, status, created_at
          from houses
          where user_id = $1
          order by created_at desc, id asc
        `,
        [userId]
      ),
      pool.query(
        `
          select
            count(*)::int as total,
            count(*) filter (where status = 'planned')::int as planned,
            count(*) filter (where status = 'due')::int as due,
            count(*) filter (where status = 'overdue')::int as overdue,
            count(*) filter (where status = 'done')::int as done
          from maintenance_tasks
          where user_id = $1 and deleted_at is null
        `,
        [userId]
      ),
      pool.query(
        `
          select count(*)::int as total, max(created_at) as latest_completed_at
          from maintenance_completions
          where user_id = $1
        `,
        [userId]
      ),
      pool.query(
        `
          select
            count(mr.*)::int as total,
            count(mr.*) filter (where mr.status = 'pending')::int as pending,
            count(mr.*) filter (where mr.status = 'accepted')::int as accepted,
            count(mr.*) filter (where mr.status = 'dismissed')::int as dismissed,
            count(distinct mh.id)::int as permanent_hidden
          from users u
          left join maintenance_recommendations mr on mr.user_id = u.id
          left join houses h on h.user_id = u.id
          left join maintenance_recommendation_hides mh on mh.house_id = h.id and mh.unhidden_at is null
          where u.id = $1
        `,
        [userId]
      )
    ]);

  const task = taskSummary.rows[0] ?? {};
  const completion = completionSummary.rows[0] ?? {};
  const recommendation = recommendationSummary.rows[0] ?? {};
  const base = mapUser(row);
  const activityCandidates = [
    row.updated_at,
    row.last_login_at,
    row.latest_session_activity_at,
    completion.latest_completed_at
  ].filter(Boolean) as Date[];
  const latestActivityAt =
    activityCandidates.length === 0
      ? null
      : new Date(
          Math.max(...activityCandidates.map((value) => value.getTime()))
        ).toISOString();

  return adminUserResponseSchema.parse({
    user: {
      ...base,
      emailVerifiedAt: iso(row.email_verified_at),
      updatedAt: row.updated_at.toISOString(),
      houses: houses.rows.map((house) => ({
        id: house.id,
        addressLabel: house.address_label,
        status: house.status,
        createdAt: house.created_at.toISOString()
      })),
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
        total: count(recommendation.total),
        pending: count(recommendation.pending),
        accepted: count(recommendation.accepted),
        dismissed: count(recommendation.dismissed),
        permanentHidden: count(recommendation.permanent_hidden)
      },
      latestActivityAt
    },
    generatedAt: new Date().toISOString()
  });
}
