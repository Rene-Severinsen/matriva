import { useEffect, useState } from "react";
import type { MatrivaApiClient } from "@matriva/api-client";
import type {
  AdminDashboardPeriodKey,
  AdminDashboardResponse,
  AdminDashboardSeriesPoint
} from "@matriva/shared";

const periods: Array<{ key: AdminDashboardPeriodKey; label: string }> = [
  { key: "7d", label: "7 dage" },
  { key: "30d", label: "30 dage" },
  { key: "90d", label: "90 dage" },
  { key: "365d", label: "12 måneder" }
];

const numberFormatter = new Intl.NumberFormat("da-DK");
const percentFormatter = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 1
});

type LoadState =
  | { status: "loading" }
  | { status: "ready"; dashboard: AdminDashboardResponse }
  | { status: "error"; message: string };

export function DashboardPage({
  client,
  onAuthorizationError
}: {
  client: MatrivaApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
}) {
  const [period, setPeriod] = useState<AdminDashboardPeriodKey>("30d");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    async function load() {
      try {
        const dashboard = await client.getAdminDashboard({
          period,
          signal: controller.signal
        });

        if (!controller.signal.aborted) {
          setState({ status: "ready", dashboard });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (await onAuthorizationError(error)) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Dashboardet kunne ikke indlæses."
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [client, onAuthorizationError, period, reloadKey]);

  return (
    <div className="dashboard-page">
      <section className="dashboard-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Drifts- og produktblik på reel brug af Matriva.</p>
        </div>
        <div className="dashboard-controls">
          <label htmlFor="dashboard-period">Periode</label>
          <select
            id="dashboard-period"
            onChange={(event) =>
              setPeriod(event.target.value as AdminDashboardPeriodKey)
            }
            value={period}
          >
            {periods.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="updated-at">
            {state.status === "ready"
              ? `Senest opdateret ${formatDateTime(state.dashboard.generatedAt)}`
              : "Opdaterer..."}
          </span>
        </div>
      </section>

      {state.status === "error" ? (
        <section className="dashboard-error" role="alert">
          <div>
            <strong>Dashboardet kunne ikke indlæses</strong>
            <p>{state.message}</p>
          </div>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            Prøv igen
          </button>
        </section>
      ) : null}

      {state.status === "loading" ? (
        <DashboardSkeleton />
      ) : state.status === "ready" ? (
        <DashboardContent dashboard={state.dashboard} />
      ) : null}
    </div>
  );
}

function DashboardContent({ dashboard }: { dashboard: AdminDashboardResponse }) {
  const kpis = [
    {
      label: "Totale brugere",
      value: dashboard.totals.users,
      note: "Alle registrerede brugere"
    },
    {
      label: "Aktive brugere",
      value: dashboard.periodMetrics.activeUsers,
      note: "Sessionaktivitet i valgt periode"
    },
    {
      label: "Totale boliger",
      value: dashboard.totals.houses,
      note: "Alle oprettede boliger"
    },
    {
      label: "Udførte opgaver",
      value: dashboard.periodMetrics.completedTasks,
      note: "Registreret i valgt periode"
    },
    {
      label: "Accepterede anbefalinger",
      value: dashboard.periodMetrics.acceptedRecommendations,
      note: "Estimeret via seneste ændring",
      estimated: true
    },
    {
      label: "Andel afsluttede opgaver",
      value: percentFormatter.format(dashboard.ratios.completedTaskRate),
      note: "Opgaver med mindst én completion"
    }
  ];

  return (
    <>
      <section className="kpi-grid" aria-label="Nøgletal">
        {kpis.map((kpi) => (
          <article className="kpi-card" key={kpi.label}>
            <div className="kpi-label">
              <span>{kpi.label}</span>
              {kpi.estimated ? (
                <span
                  className="quality-badge"
                  title="Accepttidspunkt findes ikke endnu. Updated_at bruges som proxy."
                >
                  Estimat
                </span>
              ) : null}
            </div>
            <strong>
              {typeof kpi.value === "number"
                ? numberFormatter.format(kpi.value)
                : kpi.value}
            </strong>
            <p>{kpi.note}</p>
          </article>
        ))}
      </section>

      <section className="chart-grid" aria-label="Udvikling over tid">
        <LineChart title="Brugerudvikling" points={dashboard.series.newUsers} />
        <LineChart title="Udførte opgaver" points={dashboard.series.completedTasks} />
        <LineChart title="Boligudvikling" points={dashboard.series.newHouses} />
        <LineChart
          estimated
          title="Accepterede anbefalinger"
          points={dashboard.series.acceptedRecommendations}
        />
      </section>

      <Funnel dashboard={dashboard} />
    </>
  );
}

function LineChart({
  estimated = false,
  points,
  title
}: {
  estimated?: boolean;
  points: AdminDashboardSeriesPoint[];
  title: string;
}) {
  const width = 600;
  const height = 190;
  const paddingX = 20;
  const paddingY = 20;
  const max = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => {
    const x =
      points.length <= 1
        ? width / 2
        : paddingX + (index / (points.length - 1)) * (width - paddingX * 2);
    const y =
      height - paddingY - (point.value / max) * (height - paddingY * 2);
    return { ...point, x, y };
  });

  return (
    <article className="chart-card">
      <header>
        <h3>{title}</h3>
        {estimated ? (
          <span
            className="quality-badge"
            title="Tidsserien bruger recommendation updated_at som proxy for accepttidspunkt."
          >
            Estimat
          </span>
        ) : null}
      </header>
      <div className="chart-canvas">
        <svg
          aria-label={`${title}, ${points.length} datapunkter`}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <line
            className="chart-axis"
            x1={paddingX}
            x2={width - paddingX}
            y1={height - paddingY}
            y2={height - paddingY}
          />
          {coordinates.length > 1 ? (
            <polyline
              className="chart-line"
              points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          ) : null}
          {coordinates.map((point) => (
            <circle className="chart-point" cx={point.x} cy={point.y} key={point.bucketStart} r="4">
              <title>
                {formatBucket(point.bucketStart)}: {numberFormatter.format(point.value)}
              </title>
            </circle>
          ))}
        </svg>
        {points[0] ? (
          <div className="chart-labels">
            <span>{formatBucket(points[0].bucketStart)}</span>
            <span>{formatBucket(points.at(-1)?.bucketStart ?? "")}</span>
          </div>
        ) : (
          <p className="chart-empty">Ingen datapunkter i perioden</p>
        )}
      </div>
    </article>
  );
}

function Funnel({ dashboard }: { dashboard: AdminDashboardResponse }) {
  const registered = dashboard.funnel.registeredUsers;
  const steps = [
    ["Registrerede brugere", dashboard.funnel.registeredUsers],
    ["Profil gennemført", dashboard.funnel.usersWithCompletedProfile],
    ["Bolig oprettet", dashboard.funnel.usersWithHouse],
    ["Opgave oprettet eller accepteret", dashboard.funnel.usersWithTask],
    ["Opgave udført", dashboard.funnel.usersWithCompletion]
  ] as const;

  return (
    <section className="funnel-section">
      <header>
        <div>
          <h3>Aktiveringsfunnel</h3>
          <p>Aktuelt snapshot for kumulative aktiveringstrin.</p>
        </div>
      </header>
      <div className="funnel-list">
        {steps.map(([label, value]) => {
          const rate = registered === 0 ? 0 : value / registered;

          return (
            <div className="funnel-row" key={label}>
              <div className="funnel-copy">
                <span>{label}</span>
                <strong>
                  {numberFormatter.format(value)} · {percentFormatter.format(rate)}
                </strong>
              </div>
              <div className="funnel-track">
                <span style={{ width: `${Math.max(rate * 100, value > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Indlæser dashboard" aria-live="polite">
      <section className="kpi-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="kpi-card skeleton-card" key={index}>
            <span />
            <strong />
            <p />
          </div>
        ))}
      </section>
      <section className="chart-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="chart-card skeleton-chart" key={index} />
        ))}
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBucket(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}
