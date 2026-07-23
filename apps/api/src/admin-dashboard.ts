import {
  adminDashboardResponseSchema,
  type AdminDashboardPeriodKey,
  type AdminDashboardResponse,
  type AdminDashboardSeriesPoint
} from "@matriva/shared";

import { pool } from "./db.ts";

const periodDays: Record<AdminDashboardPeriodKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365
};

const bucketConfig: Record<
  AdminDashboardPeriodKey,
  { unit: "day" | "week" | "month"; step: string }
> = {
  "7d": { unit: "day", step: "1 day" },
  "30d": { unit: "day", step: "1 day" },
  "90d": { unit: "week", step: "1 week" },
  "365d": { unit: "month", step: "1 month" }
};

type DashboardAggregateRow = {
  total_users: number;
  total_houses: number;
  total_tasks: number;
  total_completions: number;
  new_users: number;
  active_users: number;
  new_houses: number;
  created_tasks: number;
  completed_tasks: number;
  accepted_recommendations: number;
  permanent_hides: number;
  users_with_house: number;
  completed_task_count: number;
  completed_profiles: number;
  funnel_houses: number;
  funnel_tasks: number;
  funnel_completions: number;
};

type SeriesRow = {
  bucket_start: Date;
  value: number;
};

type SeriesDefinition = {
  table: string;
  timestamp: string;
  where: string;
};

const seriesDefinitions = {
  newUsers: {
    table: "users",
    timestamp: "created_at",
    where: "true"
  },
  newHouses: {
    table: "houses",
    timestamp: "created_at",
    where: "true"
  },
  completedTasks: {
    table: "maintenance_completions",
    timestamp: "created_at",
    where: "true"
  },
  acceptedRecommendations: {
    table: "maintenance_recommendations",
    timestamp: "updated_at",
    where: "status = 'accepted'"
  }
} satisfies Record<string, SeriesDefinition>;

function count(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

async function loadSeries(
  definition: SeriesDefinition,
  period: AdminDashboardPeriodKey,
  from: Date,
  to: Date
): Promise<AdminDashboardSeriesPoint[]> {
  const { unit, step } = bucketConfig[period];
  const result = await pool.query<SeriesRow>(
    `
      with buckets as (
        select generate_series(
          date_trunc('${unit}', $1::timestamptz at time zone 'UTC'),
          date_trunc('${unit}', ($2::timestamptz - interval '1 microsecond') at time zone 'UTC'),
          interval '${step}'
        ) as bucket_start
      ),
      event_counts as (
        select
          date_trunc('${unit}', ${definition.timestamp} at time zone 'UTC') as bucket_start,
          count(*)::int as value
        from ${definition.table}
        where ${definition.timestamp} >= $1
          and ${definition.timestamp} < $2
          and ${definition.where}
        group by 1
      )
      select
        buckets.bucket_start at time zone 'UTC' as bucket_start,
        coalesce(event_counts.value, 0)::int as value
      from buckets
      left join event_counts using (bucket_start)
      order by buckets.bucket_start
    `,
    [from, to]
  );

  return result.rows.map((row) => ({
    bucketStart: row.bucket_start.toISOString(),
    value: count(row.value)
  }));
}

export async function getAdminDashboard(
  period: AdminDashboardPeriodKey
): Promise<AdminDashboardResponse> {
  const generatedAt = new Date();
  const to = generatedAt;
  const from = new Date(to.getTime() - periodDays[period] * 24 * 60 * 60 * 1000);
  const aggregateResult = await pool.query<DashboardAggregateRow>(
    `
      select
        (select count(*)::int from users) as total_users,
        (select count(*)::int from houses) as total_houses,
        (select count(*)::int from maintenance_tasks where deleted_at is null) as total_tasks,
        (select count(*)::int from maintenance_completions) as total_completions,
        (select count(*)::int from users where created_at >= $1 and created_at < $2) as new_users,
        (
          select count(distinct user_id)::int
          from auth_sessions
          where last_used_at >= $1 and last_used_at < $2
        ) as active_users,
        (select count(*)::int from houses where created_at >= $1 and created_at < $2) as new_houses,
        (
          select count(*)::int
          from maintenance_tasks
          where created_at >= $1 and created_at < $2 and deleted_at is null
        ) as created_tasks,
        (
          select count(*)::int
          from maintenance_completions
          where created_at >= $1 and created_at < $2
        ) as completed_tasks,
        (
          select count(*)::int
          from maintenance_recommendations
          where status = 'accepted' and updated_at >= $1 and updated_at < $2
        ) as accepted_recommendations,
        (
          select count(*)::int
          from maintenance_recommendation_hides
          where hidden_at >= $1 and hidden_at < $2
        ) as permanent_hides,
        (
          select count(distinct user_id)::int
          from houses
        ) as users_with_house,
        (
          select count(distinct task_id)::int
          from maintenance_completions
          where task_id in (
            select id from maintenance_tasks where deleted_at is null
          )
        ) as completed_task_count,
        (
          select count(*)::int
          from users u
          where exists (
            select 1
            from user_profiles up
            where up.user_id = u.id and up.display_name is not null
          )
        ) as completed_profiles,
        (
          select count(*)::int
          from users u
          where exists (
            select 1
            from user_profiles up
            where up.user_id = u.id and up.display_name is not null
          )
          and exists (select 1 from houses h where h.user_id = u.id)
        ) as funnel_houses,
        (
          select count(*)::int
          from users u
          where exists (
            select 1
            from user_profiles up
            where up.user_id = u.id and up.display_name is not null
          )
          and exists (
            select 1
            from houses h
            join maintenance_tasks mt on mt.house_id = h.id
            where h.user_id = u.id and mt.deleted_at is null
          )
        ) as funnel_tasks,
        (
          select count(*)::int
          from users u
          where exists (
            select 1
            from user_profiles up
            where up.user_id = u.id and up.display_name is not null
          )
          and exists (
            select 1
            from houses h
            join maintenance_tasks mt on mt.house_id = h.id and mt.deleted_at is null
            join maintenance_completions mc on mc.task_id = mt.id
            where h.user_id = u.id
          )
        ) as funnel_completions
    `,
    [from, to]
  );
  const aggregate = aggregateResult.rows[0];

  if (!aggregate) {
    throw new Error("Admin dashboard aggregate query returned no row.");
  }

  const [
    newUsers,
    newHouses,
    completedTasks,
    acceptedRecommendations
  ] = await Promise.all([
    loadSeries(seriesDefinitions.newUsers, period, from, to),
    loadSeries(seriesDefinitions.newHouses, period, from, to),
    loadSeries(seriesDefinitions.completedTasks, period, from, to),
    loadSeries(seriesDefinitions.acceptedRecommendations, period, from, to)
  ]);

  const totalUsers = count(aggregate.total_users);
  const totalTasks = count(aggregate.total_tasks);

  return adminDashboardResponseSchema.parse({
    period: {
      key: period,
      from: from.toISOString(),
      to: to.toISOString()
    },
    totals: {
      users: totalUsers,
      houses: count(aggregate.total_houses),
      maintenanceTasks: totalTasks,
      maintenanceCompletions: count(aggregate.total_completions)
    },
    periodMetrics: {
      newUsers: count(aggregate.new_users),
      activeUsers: count(aggregate.active_users),
      newHouses: count(aggregate.new_houses),
      createdTasks: count(aggregate.created_tasks),
      completedTasks: count(aggregate.completed_tasks),
      acceptedRecommendations: count(aggregate.accepted_recommendations),
      permanentRecommendationHides: count(aggregate.permanent_hides)
    },
    ratios: {
      usersWithHouseRate: ratio(count(aggregate.users_with_house), totalUsers),
      completedTaskRate: ratio(count(aggregate.completed_task_count), totalTasks)
    },
    funnel: {
      registeredUsers: totalUsers,
      usersWithCompletedProfile: count(aggregate.completed_profiles),
      usersWithHouse: count(aggregate.funnel_houses),
      usersWithTask: count(aggregate.funnel_tasks),
      usersWithCompletion: count(aggregate.funnel_completions)
    },
    series: {
      newUsers,
      newHouses,
      completedTasks,
      acceptedRecommendations
    },
    dataQuality: {
      acceptedRecommendations: "estimated"
    },
    generatedAt: generatedAt.toISOString()
  });
}
