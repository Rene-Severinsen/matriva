import { randomBytes } from "node:crypto";

import {
  adminTaskClusterResponseSchema,
  adminTaskClustersResponseSchema,
  taskClusterStatusSchema,
  type AdminTaskClusterResponse,
  type AdminTaskClustersResponse,
  type TaskClusterStatus,
  type UpdateAdminTaskClusterRequest
} from "@matriva/shared";

import { ApiError, pool } from "./db.ts";
import {
  classifyUserMaintenanceTask,
  USER_TASK_CLASSIFIER_VERSION
} from "./maintenance-task-classifier.ts";

const confidenceThreshold = 0.55;

function newClusterId() {
  return `tcluster_${randomBytes(12).toString("hex")}`;
}

function count(value: unknown) {
  return Number(value ?? 0);
}

function dateValue(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

type TaskRow = {
  task_id: string;
  cluster_id: string | null;
  title: string;
  description: string | null;
  user_id: string;
  house_id: string;
  created_at: Date;
  season: "spring" | "summer" | "autumn" | "winter" | "all_year" | null;
  classification_method: "normalization" | "known_match" | "semantic" | "manual" | null;
  confidence: number | string | null;
};

async function ensureAssignments() {
  const tasks = await pool.query<{ id: string; title: string; description: string | null }>(
    `select id, title, description
     from maintenance_tasks
     where source = 'user_created' and deleted_at is null`
  );
  const catalogVersions = await pool.query<{ catalog_key: string; catalog_version: string }>(
    "select catalog_key, catalog_version from maintenance_catalog_items"
  );
  const versions = new Map(catalogVersions.rows.map((row) => [row.catalog_key, row.catalog_version]));

  for (const task of tasks.rows) {
    const classification = classifyUserMaintenanceTask(task.title, task.description);
    const catalogVersion = classification.coverageCatalogKey
      ? versions.get(classification.coverageCatalogKey) ?? null
      : null;
    const shouldAssign = Boolean(classification.clusterKey && classification.confidence >= confidenceThreshold);
    let clusterId: string | null = null;

    if (shouldAssign && classification.clusterKey && classification.label) {
      const status: TaskClusterStatus = catalogVersion ? "covered" : "candidate";
      const cluster = await pool.query<{ id: string }>(
        `insert into maintenance_task_clusters (
           id, cluster_key, label, status, coverage_catalog_key, coverage_catalog_version, classifier_version
         ) values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (cluster_key) do update set
           label = case when maintenance_task_clusters.status in ('ignored', 'adopted', 'under_review')
             then maintenance_task_clusters.label else excluded.label end,
           coverage_catalog_key = case when maintenance_task_clusters.status in ('ignored', 'adopted', 'under_review')
             then maintenance_task_clusters.coverage_catalog_key else excluded.coverage_catalog_key end,
           coverage_catalog_version = case when maintenance_task_clusters.status in ('ignored', 'adopted', 'under_review')
             then maintenance_task_clusters.coverage_catalog_version else excluded.coverage_catalog_version end,
           classifier_version = excluded.classifier_version,
           updated_at = now()
         returning id`,
        [newClusterId(), classification.clusterKey, classification.label, status, classification.coverageCatalogKey, catalogVersion, USER_TASK_CLASSIFIER_VERSION]
      );
      clusterId = cluster.rows[0]?.id ?? null;
    }

    await pool.query(
      `insert into maintenance_task_cluster_memberships (
         task_id, cluster_id, normalized_text, classification_method, confidence, classifier_version
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (task_id) do update set
         cluster_id = excluded.cluster_id,
         normalized_text = excluded.normalized_text,
         classification_method = excluded.classification_method,
         confidence = excluded.confidence,
         classifier_version = excluded.classifier_version,
         classified_at = now(),
         updated_at = now()
       where maintenance_task_cluster_memberships.classification_method <> 'manual'`,
      [task.id, clusterId, classification.normalizedText, classification.method, classification.confidence, USER_TASK_CLASSIFIER_VERSION]
    );
  }
}

function seasonCounts(rows: TaskRow[]) {
  const result = { spring: 0, summer: 0, autumn: 0, winter: 0, all_year: 0, unknown: 0 };
  for (const row of rows) result[row.season ?? "unknown"] += 1;
  return result;
}

function trend(rows: TaskRow[]) {
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const bucket = new Date(row.created_at);
    bucket.setUTCDate(1);
    const key = bucket.toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([bucketStart, value]) => ({ bucketStart, value }));
}

function mapTask(row: TaskRow) {
  return {
    id: row.task_id,
    title: row.title,
    description: row.description,
    userId: row.user_id,
    houseId: row.house_id,
    createdAt: dateValue(row.created_at),
    season: row.season,
    classificationMethod: row.classification_method ?? "semantic",
    confidence: Number(row.confidence ?? 0)
  };
}

async function loadClusterData(status?: TaskClusterStatus, query?: string) {
  await ensureAssignments();
  const values: unknown[] = [];
  const clauses: string[] = [];
  if (status) {
    values.push(status);
    clauses.push(`c.status = $${values.length}`);
  }
  if (query) {
    values.push(`%${query.toLowerCase()}%`);
    clauses.push(`(lower(c.label) like $${values.length} or lower(c.cluster_key) like $${values.length})`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const clusters = await pool.query(
    `select c.id, c.cluster_key, c.label, c.status, c.coverage_catalog_key, c.coverage_catalog_version,
            max(mci.guide_template_id) as guide_template_id,
            max(mci.guide_version_id) as guide_version_id,
            c.created_at, c.updated_at,
            count(m.task_id)::int as task_count,
            count(distinct t.user_id)::int as unique_user_count
     from maintenance_task_clusters c
     left join maintenance_catalog_items mci on mci.catalog_key = c.coverage_catalog_key and mci.catalog_version = c.coverage_catalog_version
     left join maintenance_task_cluster_memberships m on m.cluster_id = c.id
     left join maintenance_tasks t on t.id = m.task_id and t.deleted_at is null
     ${where}
     group by c.id
     order by task_count desc, c.updated_at desc`,
    values
  );
  const taskRows = await pool.query<TaskRow>(
    `select m.task_id, m.cluster_id, t.title, t.description, t.user_id, t.house_id, t.created_at, t.season,
            m.classification_method, m.confidence
     from maintenance_task_cluster_memberships m
     join maintenance_tasks t on t.id = m.task_id
     where t.source = 'user_created' and t.deleted_at is null
     order by t.created_at desc`
  );
  const housing = await pool.query<{
    cluster_id: string;
    house_count: number | string;
    bfe_coverage: number | string;
    construction_year_min: number | null;
    construction_year_max: number | null;
    average_residential_area_m2: number | string | null;
  }>(
    `select m.cluster_id,
            count(distinct t.house_id)::int as house_count,
            count(distinct s.house_id)::int as bfe_coverage,
            min(b.construction_year)::int as construction_year_min,
            max(b.construction_year)::int as construction_year_max,
            round(avg(nullif(b.residential_area_m2, 0)))::int as average_residential_area_m2
     from maintenance_task_cluster_memberships m
     join maintenance_tasks t on t.id = m.task_id and t.deleted_at is null
     left join house_public_data_snapshots s on s.house_id = t.house_id and s.is_current
     left join house_public_buildings b on b.snapshot_id = s.id and b.is_address_building
     where m.cluster_id is not null
     group by m.cluster_id`
  );
  const housingByCluster = new Map(housing.rows.map((row) => [row.cluster_id, row]));
  const tasksByCluster = new Map<string, TaskRow[]>();
  const unclassified: TaskRow[] = [];
  for (const row of taskRows.rows) {
    if (!row.cluster_id) unclassified.push(row);
    else tasksByCluster.set(row.cluster_id, [...(tasksByCluster.get(row.cluster_id) ?? []), row]);
  }

  const items = clusters.rows.map((row) => {
    const rows = tasksByCluster.get(row.id) ?? [];
    const housingRow = housingByCluster.get(row.id);
    const representativeFormulations = [...new Set(rows.map((task) => task.title.trim()).filter(Boolean))].slice(0, 5);
    return {
      id: row.id,
      clusterKey: row.cluster_key,
      taskType: row.label,
      status: row.status,
      uniqueUserCount: count(row.unique_user_count),
      taskCount: count(row.task_count),
      trend: trend(rows),
      representativeFormulations,
      coverage: row.coverage_catalog_key
        ? { covered: true, catalogKey: row.coverage_catalog_key, catalogVersion: row.coverage_catalog_version, guideTemplateId: row.guide_template_id, guideVersionId: row.guide_version_id }
        : { covered: false, catalogKey: null, catalogVersion: null, guideTemplateId: null, guideVersionId: null },
      seasonDistribution: seasonCounts(rows),
      housingAttributes: {
        houseCount: count(housingRow?.house_count),
        bfeCoverage: count(housingRow?.bfe_coverage),
        constructionYearMin: housingRow?.construction_year_min ?? null,
        constructionYearMax: housingRow?.construction_year_max ?? null,
        averageResidentialAreaM2: housingRow?.average_residential_area_m2 == null ? null : count(housingRow.average_residential_area_m2)
      },
      tasks: rows.slice(0, 50).map(mapTask),
      createdAt: dateValue(row.created_at),
      updatedAt: dateValue(row.updated_at)
    };
  });

  return { items, unclassifiedTasks: unclassified.slice(0, 100).map(mapTask), totalUnclassified: unclassified.length };
}

export async function listAdminTaskClusters(params: URLSearchParams): Promise<AdminTaskClustersResponse> {
  const statusParam = params.get("status");
  const parsedStatus = statusParam && statusParam !== "all" ? taskClusterStatusSchema.safeParse(statusParam) : null;
  if (parsedStatus && !parsedStatus.success) throw new ApiError(400, "admin_task_cluster_status_invalid", "Clusterstatus er ugyldig.");
  const status = parsedStatus?.success ? parsedStatus.data : undefined;
  const query = params.get("query")?.trim() || undefined;
  const data = await loadClusterData(status, query);
  return adminTaskClustersResponseSchema.parse({ ...data, generatedAt: new Date().toISOString() });
}

export async function getAdminTaskCluster(id: string): Promise<AdminTaskClusterResponse> {
  const data = await loadClusterData();
  const item = data.items.find((candidate) => candidate.id === id);
  if (!item) throw new ApiError(404, "admin_task_cluster_not_found", "Task cluster was not found.");
  return adminTaskClusterResponseSchema.parse({ item, generatedAt: new Date().toISOString() });
}

async function catalogCoverage(catalogKey: string | null) {
  if (!catalogKey) return { key: null, version: null };
  const result = await pool.query<{ catalog_version: string }>("select catalog_version from maintenance_catalog_items where catalog_key = $1 and is_active", [catalogKey]);
  if (!result.rows[0]) throw new ApiError(400, "admin_task_cluster_catalog_not_found", "Anbefalingen findes ikke i Matrivas katalog.");
  return { key: catalogKey, version: result.rows[0].catalog_version };
}

export async function updateAdminTaskCluster(id: string, input: UpdateAdminTaskClusterRequest, adminUserId: string) {
  const existing = await pool.query<{ coverage_catalog_key: string | null }>("select coverage_catalog_key from maintenance_task_clusters where id = $1", [id]);
  if (!existing.rows[0]) throw new ApiError(404, "admin_task_cluster_not_found", "Task cluster was not found.");
  const requestedCatalogKey = Object.prototype.hasOwnProperty.call(input, "catalogKey")
    ? input.catalogKey ?? null
    : existing.rows[0].coverage_catalog_key;
  const coverage = await catalogCoverage(requestedCatalogKey);
  const result = await pool.query(
    `update maintenance_task_clusters
     set label = coalesce($1, label), status = coalesce($2, status),
         coverage_catalog_key = $3, coverage_catalog_version = $4,
         updated_by_admin_user_id = $5, updated_at = now()
     where id = $6
     returning id`,
    [input.taskType ?? null, input.status ?? null, coverage.key, coverage.version, adminUserId, id]
  );
  await pool.query(
    `insert into maintenance_task_cluster_audit_log (action, cluster_id, details, actor_user_id)
     values ('status_changed', $1, $2::jsonb, $3)`,
    [id, JSON.stringify({ status: input.status ?? null, taskType: input.taskType ?? null, catalogKey: coverage.key }), adminUserId]
  );
  return getAdminTaskCluster(id);
}

export async function correctAdminTaskClusterTask(taskId: string, clusterId: string | null, adminUserId: string) {
  if (clusterId) {
    const cluster = await pool.query("select 1 from maintenance_task_clusters where id = $1", [clusterId]);
    if (!cluster.rowCount) throw new ApiError(404, "admin_task_cluster_not_found", "Task cluster was not found.");
  }
  const previous = await pool.query<{ cluster_id: string | null; normalized_text: string }>(
    `select m.cluster_id, m.normalized_text
     from maintenance_task_cluster_memberships m join maintenance_tasks t on t.id = m.task_id
     where m.task_id = $1 and t.source = 'user_created' and t.deleted_at is null`,
    [taskId]
  );
  if (!previous.rows[0]) throw new ApiError(404, "admin_task_cluster_task_not_found", "Brugeropgaven blev ikke fundet.");
  await pool.query(
    `insert into maintenance_task_cluster_memberships (task_id, cluster_id, normalized_text, classification_method, confidence, classifier_version, updated_by_admin_user_id)
     values ($1, $2, $3, 'manual', 1, $4, $5)
     on conflict (task_id) do update set cluster_id = excluded.cluster_id, classification_method = 'manual', confidence = 1,
       classifier_version = excluded.classifier_version, updated_by_admin_user_id = excluded.updated_by_admin_user_id, updated_at = now()`,
    [taskId, clusterId, previous.rows[0].normalized_text, USER_TASK_CLASSIFIER_VERSION, adminUserId]
  );
  await pool.query(
    `insert into maintenance_task_cluster_audit_log (action, task_id, from_cluster_id, to_cluster_id, details, actor_user_id)
     values ('corrected', $1, $2, $3, '{}'::jsonb, $4)`,
    [taskId, previous.rows[0].cluster_id, clusterId, adminUserId]
  );
  return clusterId ? getAdminTaskCluster(clusterId) : listAdminTaskClusters(new URLSearchParams());
}

export async function mergeAdminTaskClusters(sourceIds: string[], targetId: string, adminUserId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
    if (sources.length === 0) throw new ApiError(400, "admin_task_cluster_merge_empty", "Vælg mindst én kildecluster.");
    const sourceResult = await client.query("select id from maintenance_task_clusters where id = any($1::text[])", [sources]);
    const targetResult = await client.query("select id from maintenance_task_clusters where id = $1", [targetId]);
    if (sourceResult.rowCount !== sources.length || !targetResult.rowCount) throw new ApiError(404, "admin_task_cluster_not_found", "En valgt cluster findes ikke.");
    await client.query(
      `update maintenance_task_cluster_memberships set cluster_id = $1, classification_method = 'manual', confidence = 1,
       updated_by_admin_user_id = $2, updated_at = now() where cluster_id = any($3::text[])`,
      [targetId, adminUserId, sources]
    );
    await client.query(`update maintenance_task_clusters set status = 'ignored', updated_by_admin_user_id = $1, updated_at = now() where id = any($2::text[])`, [adminUserId, sources]);
    await client.query(`insert into maintenance_task_cluster_audit_log (action, cluster_id, to_cluster_id, details, actor_user_id) values ('merged', $1, $2, $3::jsonb, $4)`, [targetId, targetId, JSON.stringify({ sourceIds: sources }), adminUserId]);
    await client.query("commit");
    return getAdminTaskCluster(targetId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function splitAdminTaskCluster(clusterId: string, taskIds: string[], taskType: string | undefined, adminUserId: string) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const cluster = await client.query<{ label: string }>("select label from maintenance_task_clusters where id = $1", [clusterId]);
    if (!cluster.rows[0]) throw new ApiError(404, "admin_task_cluster_not_found", "Task cluster was not found.");
    const tasks = [...new Set(taskIds)];
    const members = await client.query("select task_id from maintenance_task_cluster_memberships where cluster_id = $1 and task_id = any($2::text[])", [clusterId, tasks]);
    if (members.rowCount !== tasks.length) throw new ApiError(400, "admin_task_cluster_split_membership_invalid", "Alle opgaver skal høre til den valgte cluster.");
    const newId = newClusterId();
    await client.query(
      `insert into maintenance_task_clusters (id, cluster_key, label, status, classifier_version, created_by_admin_user_id, updated_by_admin_user_id)
       values ($1, $2, $3, 'candidate', $4, $5, $5)`,
      [newId, `manual:${newId}`, taskType?.trim() || `${cluster.rows[0].label} (opdelt)`, USER_TASK_CLASSIFIER_VERSION, adminUserId]
    );
    await client.query(
      `update maintenance_task_cluster_memberships set cluster_id = $1, classification_method = 'manual', confidence = 1,
       updated_by_admin_user_id = $2, updated_at = now() where task_id = any($3::text[])`,
      [newId, adminUserId, tasks]
    );
    await client.query(`insert into maintenance_task_cluster_audit_log (action, cluster_id, from_cluster_id, to_cluster_id, details, actor_user_id) values ('split', $1, $2, $3, $4::jsonb, $5)`, [clusterId, clusterId, newId, JSON.stringify({ taskIds: tasks }), adminUserId]);
    await client.query("commit");
    return getAdminTaskCluster(newId);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
