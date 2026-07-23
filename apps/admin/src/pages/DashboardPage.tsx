import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { MatrivaApiClient } from "@matriva/api-client";
import type {
  AdminDashboardPeriodKey,
  AdminDashboardResponse,
  AdminDashboardSeriesPoint
} from "@matriva/shared";

import { Icon, type IconName } from "../components/Icon.js";

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
          <div aria-label="Periode" className="period-switch" role="group">
            {periods.map((option) => (
              <button
                aria-pressed={period === option.key}
                key={option.key}
                onClick={() => setPeriod(option.key)}
                type="button"
              >
                {option.key === "365d"
                  ? "12M"
                  : option.key.toLocaleUpperCase("da-DK")}
              </button>
            ))}
          </div>
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
  const kpis: Array<{
    label: string;
    value: number | string;
    note: string;
    icon: IconName;
    tone: "blue" | "orange" | "green" | "teal" | "purple" | "indigo" | "yellow";
    estimated?: boolean;
  }> = [
    {
      label: "Totale brugere",
      value: dashboard.totals.users,
      note: "Alle registrerede brugere",
      icon: "users" as IconName,
      tone: "blue"
    },
    {
      label: "Aktive brugere",
      value: dashboard.periodMetrics.activeUsers,
      note: "Sessionaktivitet i valgt periode",
      icon: "activity" as IconName,
      tone: "orange"
    },
    {
      label: "Totale boliger",
      value: dashboard.totals.houses,
      note: "Alle oprettede boliger",
      icon: "houses" as IconName,
      tone: "green"
    },
    {
      label: "BBR warnings",
      value: dashboard.totals.publicDataWarnings,
      note: "Warnings på tværs af boliger",
      icon: "activity" as IconName,
      tone: "yellow"
    },
    {
      label: "Udførte opgaver",
      value: dashboard.periodMetrics.completedTasks,
      note: "Registreret i valgt periode",
      icon: "check" as IconName,
      tone: "teal"
    },
    {
      label: "Accepterede anbefalinger",
      value: dashboard.periodMetrics.acceptedRecommendations,
      note: "Estimeret via seneste ændring",
      estimated: true,
      icon: "recommendations" as IconName,
      tone: "purple"
    },
    {
      label: "Andel afsluttede opgaver",
      value: percentFormatter.format(dashboard.ratios.completedTaskRate),
      note: "Opgaver med mindst én completion",
      icon: "dashboard" as IconName,
      tone: "indigo"
    }
  ];

  return (
    <>
      <section className="kpi-grid" aria-label="Nøgletal">
        {kpis.map((kpi) => (
          <article className={`kpi-card kpi-${kpi.tone}`} key={kpi.label}>
            <span className="kpi-icon">
              <Icon name={kpi.icon} />
            </span>
            <div className="kpi-content">
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
            </div>
          </article>
        ))}
      </section>

      <section className="chart-grid" aria-label="Udvikling over tid">
        <LineChart
          period={dashboard.period.key}
          title="Brugerudvikling"
          points={dashboard.series.newUsers}
        />
        <LineChart
          period={dashboard.period.key}
          title="Udførte opgaver"
          points={dashboard.series.completedTasks}
        />
        <LineChart
          period={dashboard.period.key}
          title="Boligudvikling"
          points={dashboard.series.newHouses}
        />
        <LineChart
          estimated
          period={dashboard.period.key}
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
  period,
  points,
  title
}: {
  estimated?: boolean;
  period: AdminDashboardPeriodKey;
  points: AdminDashboardSeriesPoint[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 600;
  const height = 240;
  const plot = {
    left: 46,
    right: 14,
    top: 16,
    bottom: 42
  };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const scale = yAxisScale(Math.max(0, ...points.map((point) => point.value)));
  const coordinates = points.map((point, index) => {
    const x =
      points.length <= 1
        ? plot.left + plotWidth / 2
        : plot.left + (index / (points.length - 1)) * plotWidth;
    const y =
      plot.top + plotHeight - (point.value / scale.max) * plotHeight;
    return { ...point, x, y };
  });
  const xLabels = xAxisLabels(points, period);
  const activePoint =
    activeIndex === null ? null : coordinates[activeIndex] ?? null;

  function updateActivePoint(
    event: ReactPointerEvent<SVGSVGElement>
  ) {
    if (coordinates.length === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width;
    const ratio = (relativeX - plot.left) / plotWidth;
    const index =
      coordinates.length === 1
        ? 0
        : Math.round(Math.max(0, Math.min(1, ratio)) * (coordinates.length - 1));
    setActiveIndex(index);
  }

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
          onPointerLeave={() => setActiveIndex(null)}
          onPointerMove={updateActivePoint}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          {scale.ticks.map((tick) => {
            const y = plot.top + plotHeight - (tick / scale.max) * plotHeight;

            return (
              <g className="chart-y-tick" key={tick}>
                <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} />
                <text x={plot.left - 9} y={y + 4}>
                  {numberFormatter.format(tick)}
                </text>
              </g>
            );
          })}
          <line
            className="chart-axis"
            x1={plot.left}
            x2={plot.left}
            y1={plot.top}
            y2={plot.top + plotHeight}
          />
          <line
            className="chart-axis"
            x1={plot.left}
            x2={width - plot.right}
            y1={plot.top + plotHeight}
            y2={plot.top + plotHeight}
          />
          {coordinates.length > 1 ? (
            <path
              className="chart-line"
              d={smoothLinePath(coordinates)}
            />
          ) : null}
          {coordinates.map((point) => (
            <circle
              className="chart-point"
              cx={point.x}
              cy={point.y}
              key={point.bucketStart}
              onBlur={() => setActiveIndex(null)}
              onFocus={() =>
                setActiveIndex(
                  coordinates.findIndex(
                    (coordinate) => coordinate.bucketStart === point.bucketStart
                  )
                )
              }
              r="4"
              tabIndex={0}
            >
              <title>
                {formatBucket(point.bucketStart)}: {numberFormatter.format(point.value)}
              </title>
            </circle>
          ))}
          {activePoint ? (
            <g className="chart-active-point">
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={plot.top}
                y2={plot.top + plotHeight}
              />
              <circle cx={activePoint.x} cy={activePoint.y} r="6" />
            </g>
          ) : null}
          {xLabels.map(({ index, point }) => {
            const coordinate = coordinates[index];

            if (!coordinate) {
              return null;
            }

            return (
              <g className="chart-x-tick" key={point.bucketStart}>
                <line
                  x1={coordinate.x}
                  x2={coordinate.x}
                  y1={plot.top + plotHeight}
                  y2={plot.top + plotHeight + 5}
                />
                <text
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === points.length - 1
                        ? "end"
                        : "middle"
                  }
                  x={coordinate.x}
                  y={height - 12}
                >
                  {formatAxisBucket(point.bucketStart, period)}
                </text>
              </g>
            );
          })}
        </svg>
        {activePoint ? (
          <div
            className={
              activePoint.x > width * 0.72
                ? "chart-tooltip align-right"
                : "chart-tooltip"
            }
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`
            }}
          >
            <strong>{formatBucket(activePoint.bucketStart)}</strong>
            <span>{numberFormatter.format(activePoint.value)}</span>
          </div>
        ) : null}
        {!points[0] ? (
          <p className="chart-empty">Ingen datapunkter i perioden</p>
        ) : null}
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

function yAxisScale(maxValue: number) {
  const minimumMax = Math.max(maxValue, 4);
  const roughStep = minimumMax / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, niceNormalized * magnitude);
  const max = Math.ceil(minimumMax / step) * step;
  const ticks = Array.from(
    { length: Math.round(max / step) + 1 },
    (_, index) => index * step
  );

  return { max, ticks };
}

function xAxisLabels(
  points: AdminDashboardSeriesPoint[],
  period: AdminDashboardPeriodKey
) {
  if (points.length === 0) {
    return [];
  }

  const desiredLabels =
    period === "7d"
      ? points.length
      : period === "365d"
        ? Math.min(7, points.length)
        : Math.min(6, points.length);
  const indexes = new Set<number>();

  for (let labelIndex = 0; labelIndex < desiredLabels; labelIndex += 1) {
    const index =
      desiredLabels === 1
        ? 0
        : Math.round((labelIndex / (desiredLabels - 1)) * (points.length - 1));
    indexes.add(index);
  }

  return [...indexes].map((index) => ({
    index,
    point: points[index] as AdminDashboardSeriesPoint
  }));
}

function formatAxisBucket(
  value: string,
  period: AdminDashboardPeriodKey
) {
  return new Intl.DateTimeFormat("da-DK", {
    ...(period === "365d"
      ? { month: "short", year: "2-digit" }
      : { day: "numeric", month: "short" }),
    timeZone: "UTC"
  }).format(new Date(value));
}

function smoothLinePath(
  points: Array<{ x: number; y: number }>
) {
  const first = points[0];

  if (!first) {
    return "";
  }

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index] as { x: number; y: number };
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX} ${previous.y}, ${middleX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${first.x} ${first.y}`);
}
