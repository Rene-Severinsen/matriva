import { useEffect, useState } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type { AdminTaskClustersResponse, TaskClusterStatus, TaskId } from "@matriva/shared";

const statusLabels: Record<TaskClusterStatus, string> = {
  covered: "Dækket",
  candidate: "Kandidat",
  under_review: "Under review",
  ignored: "Ignoreret",
  adopted: "Adopteret"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(value));
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Handlingen kunne ikke gennemføres.";
}

type Cluster = AdminTaskClustersResponse["items"][number];
type Task = AdminTaskClustersResponse["unclassifiedTasks"][number];
type RunAction = (action: () => Promise<unknown>, success: string) => Promise<void>;

export function TaskClustersPage({ client, onAuthorizationError }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [data, setData] = useState<AdminTaskClustersResponse | null>(null);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await client.getAdminTaskClusters({ status: status as TaskClusterStatus | "all", query }));
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [client, status, query]);

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(errorText(error));
    }
  }

  const items = data?.items ?? [];
  const visibleTaskCount = items.reduce((total, cluster) => total + cluster.taskCount, 0);
  const coveredCount = items.filter((cluster) => cluster.coverage.covered).length;
  const candidateCount = items.filter((cluster) => cluster.status === "candidate").length;

  return (
    <div className="admin-data-page task-clusters-page">
      <section className="task-cluster-hero">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2>Brugernes opgavetyper</h2>
          <p>Find mønstre i brugernes egne formuleringer, og gør de bedste kandidater klar til en manuel produktbeslutning.</p>
        </div>
        <div className="task-cluster-guardrail"><span aria-hidden="true">i</span><span>Rå brugerdata er uændret. Clusters bliver ikke automatisk til anbefalinger eller vejledninger.</span></div>
      </section>

      <section className="task-cluster-kpis" aria-label="Overblik">
        <Kpi label="Clusters i visning" value={items.length} />
        <Kpi label="Opgaver i clusters" value={visibleTaskCount} />
        <Kpi label="Uklassificerede" value={data?.totalUnclassified ?? 0} tone={data?.totalUnclassified ? "attention" : "normal"} />
        <Kpi label="Dækket af Matriva" value={coveredCount} note={`${candidateCount} kandidater`} />
      </section>

      <section className="task-cluster-filters">
        <label className="task-cluster-search">Søg i opgavetyper<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Fx tagrender, fuger eller varme..." /></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Alle statuser</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <span className="task-cluster-filter-note">{loading ? "Opdaterer..." : "Opdateret automatisk ved åbning"}</span>
      </section>

      {message ? <p className="state-message task-cluster-message">{message}</p> : null}
      {loading ? <section className="data-state">Indlæser overblik...</section> : data ? <>
        {data.totalUnclassified > 0 ? <UnclassifiedPanel client={client} data={data} clusters={items} run={run} /> : null}
        <MergePanel client={client} clusters={items} run={run} />
        <section className="task-cluster-section">
          <header className="task-cluster-section-header"><div><p className="eyebrow">Klassifikation</p><h3>Clusters</h3></div><span>{items.length} vist</span></header>
          {items.length > 0 ? <div className="task-cluster-table">{items.map((cluster) => <ClusterRow key={cluster.id} client={client} cluster={cluster} clusters={items} run={run} />)}</div> : <div className="data-state">Ingen clusters matcher filtrene.</div>}
        </section>
      </> : null}
    </div>
  );
}

function Kpi({ label, value, note, tone = "normal" }: { label: string; value: number; note?: string; tone?: "normal" | "attention" }) {
  return <div className={`task-cluster-kpi task-cluster-kpi-${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function UnclassifiedPanel({ client, data, clusters, run }: { client: MatrivaAdminApiClient; data: AdminTaskClustersResponse; clusters: Cluster[]; run: RunAction }) {
  return <section className="task-cluster-section task-cluster-unclassified"><header className="task-cluster-section-header"><div><p className="eyebrow">Kræver menneskelig vurdering</p><h3>Uklassificerede opgaver <span className="task-cluster-count">{data.totalUnclassified}</span></h3><p>Lav confidence holdes uden for automatisk gruppering. Tildel kun en opgave, når du er sikker.</p></div><span className="task-cluster-attention">Lav confidence</span></header><div className="task-cluster-task-table"><div className="task-cluster-task-head"><span>Formulering</span><span>Confidence</span><span>Tildel til</span><span /></div>{data.unclassifiedTasks.map((task) => <TaskCorrection key={task.id} client={client} task={task} clusters={clusters} selectedClusterId="" run={run} />)}</div></section>;
}

function MergePanel({ client, clusters, run }: { client: MatrivaAdminApiClient; clusters: Cluster[]; run: RunAction }) {
  const [sources, setSources] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  return <details className="task-cluster-section task-cluster-tools"><summary><span><strong>Flet clusters</strong><small>Samler flere formuleringer under én ejet opgavetype</small></span><span className="task-cluster-disclosure">Åbn værktøj <b>＋</b></span></summary><div className="task-cluster-tools-body"><div className="task-cluster-tool-copy"><p>Vælg de clusters, der skal flyttes, og vælg derefter den cluster, der skal overleve.</p><span>Alle flyttede opgaver markeres som manuelt klassificerede.</span></div><div className="task-cluster-merge-grid">{clusters.map((cluster) => <label key={cluster.id}><input type="checkbox" checked={sources.includes(cluster.id)} onChange={(event) => setSources((current) => event.target.checked ? [...current, cluster.id] : current.filter((id) => id !== cluster.id))} /><span>{cluster.taskType}<small>{cluster.taskCount} opgaver</small></span></label>)}</div><div className="task-cluster-tool-action"><label>Målcluster<select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Vælg målcluster...</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.taskType}</option>)}</select></label><button className="secondary-action" type="button" disabled={!target || sources.length === 0} onClick={() => void run(() => client.mergeAdminTaskClusters({ sourceClusterIds: sources, targetClusterId: target }), "Clusterne er samlet.")}>Saml clusters</button></div></div></details>;
}

function ClusterRow({ client, cluster, clusters, run }: { client: MatrivaAdminApiClient; cluster: Cluster; clusters: Cluster[]; run: RunAction }) {
  const [taskType, setTaskType] = useState(cluster.taskType);
  const [status, setStatus] = useState<TaskClusterStatus>(cluster.status);
  const [splitIds, setSplitIds] = useState("");
  useEffect(() => { setTaskType(cluster.taskType); setStatus(cluster.status); }, [cluster.taskType, cluster.status]);
  const recentTrend = cluster.trend.slice(-4).map((point) => `${formatShortDate(point.bucketStart)}: ${point.value}`).join(" · ") || "Ingen data endnu";
  const coverageLabel = cluster.coverage.covered ? `${cluster.coverage.catalogKey}${cluster.coverage.guideVersionId ? " · vejledning koblet" : " · uden vejledning"}` : "Ikke dækket af katalog";

  return <details className="task-cluster-row">
    <summary><div className="task-cluster-row-title"><span className={`task-cluster-status-dot task-cluster-status-${cluster.status}`} /><strong>{cluster.taskType}</strong><small>{cluster.clusterKey}</small></div><div className="task-cluster-row-metric"><strong>{cluster.taskCount}</strong><span>opgaver</span></div><div className="task-cluster-row-metric"><strong>{cluster.uniqueUserCount}</strong><span>brugere</span></div><div className="task-cluster-row-coverage"><span className={cluster.coverage.covered ? "is-covered" : "is-open"}>{cluster.coverage.covered ? "Dækket" : "Åben kandidat"}</span><small>{coverageLabel}</small></div><span className="task-cluster-chevron" aria-hidden="true">⌄</span></summary>
    <div className="task-cluster-detail">
      <div className="task-cluster-detail-top"><div><span className="eyebrow">{statusLabels[cluster.status]}</span><h3>{cluster.taskType}</h3><p>Senest opdateret {formatDate(cluster.updatedAt)}</p></div><div className="task-cluster-detail-actions"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as TaskClusterStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="primary-action" type="button" onClick={() => void run(() => client.updateAdminTaskCluster(cluster.id, { taskType, status, catalogKey: cluster.coverage.catalogKey }), "Clusteren er opdateret.")}>Gem ændringer</button></div></div>
      <div className="task-cluster-detail-metrics"><div><span>Udvikling</span><strong>{recentTrend}</strong></div><div><span>Sæson</span><strong>{seasonSummary(cluster)}</strong></div><div><span>Boligdata</span><strong>{cluster.housingAttributes.houseCount} boliger · {cluster.housingAttributes.bfeCoverage} med BFE</strong></div><div><span>Coverage</span><strong>{coverageLabel}</strong></div></div>
      <div className="task-cluster-detail-columns"><div><h4>Repræsentative formuleringer</h4><ul className="task-cluster-formulations">{cluster.representativeFormulations.map((text) => <li key={text}>{text}</li>)}</ul><p className="task-cluster-muted">Byggeår {cluster.housingAttributes.constructionYearMin ?? "?"}–{cluster.housingAttributes.constructionYearMax ?? "?"} · gennemsnitligt boligareal {cluster.housingAttributes.averageResidentialAreaM2 ?? "?"} m²</p></div><div><label className="task-cluster-edit-label">Opgavetype<input value={taskType} onChange={(event) => setTaskType(event.target.value)} /></label><p className="task-cluster-muted">Statusændringer påvirker kun det analytiske lag.</p></div></div>
      <details className="task-cluster-subsection"><summary>Se og korrigér {cluster.tasks.length} opgaver</summary><div className="task-cluster-task-table"><div className="task-cluster-task-head"><span>Formulering</span><span>Confidence</span><span>Tildel til</span><span /></div>{cluster.tasks.map((task) => <TaskCorrection key={task.id} client={client} task={task} clusters={clusters} selectedClusterId={cluster.id} run={run} />)}</div></details>
      <details className="task-cluster-subsection task-cluster-split"><summary>Avanceret: split cluster</summary><div className="task-cluster-split-action"><label>Task-id'er, kommasepareret<input value={splitIds} onChange={(event) => setSplitIds(event.target.value)} placeholder="task_..." /></label><button className="secondary-action" type="button" disabled={!splitIds.trim()} onClick={() => void run(() => client.splitAdminTaskCluster({ clusterId: cluster.id, taskIds: splitIds.split(",").map((id) => id.trim()).filter(Boolean).map((id) => id as TaskId), taskType: `${taskType} – ny type` }), "Clusteren er splittet.")}>Split valgte opgaver</button></div></details>
    </div>
  </details>;
}

function TaskCorrection({ client, task, clusters, selectedClusterId, run }: { client: MatrivaAdminApiClient; task: Task; clusters: Cluster[]; selectedClusterId: string; run: RunAction }) {
  const [target, setTarget] = useState(selectedClusterId);
  return <div className="task-cluster-task"><div className="task-cluster-task-copy"><strong>{task.title}</strong>{task.description ? <small>{task.description}</small> : null}<span>{task.id} · {formatDate(task.createdAt)}</span></div><span className={`task-cluster-confidence ${task.confidence < 0.55 ? "is-low" : ""}`}>{Math.round(task.confidence * 100)}%</span><select aria-label={`Cluster for ${task.title}`} value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Uklassificeret</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.taskType}</option>)}</select><button className="secondary-action" type="button" disabled={target === selectedClusterId} onClick={() => void run(() => client.correctAdminTaskClusterTask(task.id, { clusterId: target || null }), "Opgaveklassifikationen er rettet.")}>Ret</button></div>;
}

function seasonSummary(cluster: Cluster) {
  const entries = Object.entries(cluster.seasonDistribution).filter(([key, value]) => key !== "unknown" && value > 0);
  return entries.length ? entries.map(([key, value]) => `${key}: ${value}`).join(" · ") : "Ingen sæson registreret";
}

