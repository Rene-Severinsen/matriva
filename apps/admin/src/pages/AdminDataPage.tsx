import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { MatrivaApiClient } from "@matriva/api-client";
import type {
  AdminHouseResponse,
  AdminHousesResponse,
  AdminRecommendationCatalogItemResponse,
  AdminRecommendationCatalogResponse,
  AdminUserResponse,
  AdminUsersResponse
} from "@matriva/shared";

type SectionKey = "users" | "houses" | "recommendations";
type DetailKey = { section: SectionKey; id: string } | null;
type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const numberFormatter = new Intl.NumberFormat("da-DK");
const percentFormatter = new Intl.NumberFormat("da-DK", {
  style: "percent",
  maximumFractionDigits: 1
});

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("da-DK", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(value))
    : "Ikke registreret";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AdminDataPage({
  client,
  detail,
  onAuthorizationError,
  onOpenDetail,
  section
}: {
  client: MatrivaApiClient;
  detail: DetailKey;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpenDetail: (section: SectionKey, id?: string) => void;
  section: SectionKey;
}) {
  if (detail) {
    return (
      <DetailPage
        client={client}
        detail={detail}
        onAuthorizationError={onAuthorizationError}
        onBack={() => onOpenDetail(detail.section)}
      />
    );
  }

  if (section === "houses") {
    return (
      <HousesList
        client={client}
        onAuthorizationError={onAuthorizationError}
        onOpen={(id) => onOpenDetail("houses", id)}
      />
    );
  }

  if (section === "recommendations") {
    return (
      <RecommendationsList
        client={client}
        onAuthorizationError={onAuthorizationError}
        onOpen={(id) => onOpenDetail("recommendations", id)}
      />
    );
  }

  return (
    <UsersList
      client={client}
      onAuthorizationError={onAuthorizationError}
      onOpen={(id) => onOpenDetail("users", id)}
    />
  );
}

function useListState<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  onAuthorizationError: (error: unknown) => Promise<boolean>,
  fallback: string,
  deps: unknown[]
) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    async function load() {
      try {
        const data = await loader(controller.signal);
        if (!controller.signal.aborted) {
          setState({ status: "ready", data });
        }
      } catch (error) {
        if (controller.signal.aborted || (await onAuthorizationError(error))) {
          return;
        }
        setState({ status: "error", message: errorMessage(error, fallback) });
      }
    }

    void load();
    return () => controller.abort();
  }, [...deps, reloadKey]);

  return { state, retry: () => setReloadKey((value) => value + 1) };
}

function UsersList({
  client,
  onAuthorizationError,
  onOpen
}: {
  client: MatrivaApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminUsersResponse>(
    (signal) => client.getAdminUsers({ query, status: status as any, sort: sort as any, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Brugere kunne ikke indlæses.",
    [client, query, status, sort, order, page]
  );

  return (
    <DataSection
      description="Read-only oversigt over registrerede brugere og aktivitet."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[["all", "Alle"], ["active", "Aktive"], ["disabled", "Disabled"]]} />
          <SortSelect value={sort} onChange={setSort} options={[["created_at", "Oprettet"], ["latest_session_activity", "Senest aktiv"], ["email", "E-mail"], ["house_count", "Boliger"], ["task_count", "Opgaver"]]} />
          <OrderButton order={order} setOrder={setOrder} />
        </>
      }
      title="Brugere"
    >
      <ListState state={state} retry={retry} empty="Ingen brugere matcher filtrene.">
        {(data) => (
          <>
            <ResultCount total={data.pagination.total} />
            <div className="table-scroll">
              <table className="data-table users-table">
                <thead>
                  <tr><th>Bruger</th><th>Status</th><th>Oprettet</th><th>Senest aktiv</th><th>Boliger</th><th>Opgaver</th><th>Completions</th><th>Rolle</th></tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} onClick={() => onOpen(user.id)}>
                      <td><strong>{user.displayName ?? "Navn mangler"}</strong><span>{user.email}</span></td>
                      <td><StatusBadge label={user.status} /></td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.latestSessionActivityAt ?? user.lastLoginAt)}</td>
                      <td>{numberFormatter.format(user.houseCount)}</td>
                      <td>{numberFormatter.format(user.taskCount)}</td>
                      <td>{numberFormatter.format(user.completionCount)}</td>
                      <td>{user.roles.join(", ") || "Bruger"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} setPage={setPage} />
          </>
        )}
      </ListState>
    </DataSection>
  );
}

function HousesList({
  client,
  onAuthorizationError,
  onOpen
}: {
  client: MatrivaApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [publicDataStatus, setPublicDataStatus] = useState("all");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminHousesResponse>(
    (signal) => client.getAdminHouses({ query, publicDataStatus: publicDataStatus as any, sort: sort as any, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Boliger kunne ikke indlæses.",
    [client, query, publicDataStatus, sort, order, page]
  );

  return (
    <DataSection
      description="Read-only oversigt over boliger, ejere og BBR-status."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="BBR" value={publicDataStatus} onChange={(value) => { setPublicDataStatus(value); setPage(1); }} options={[["all", "Alle"], ["success", "Success"], ["partial", "Partial"], ["with_warnings", "Warnings"], ["not_started", "Ikke startet"], ["failed", "Fejlet"]]} />
          <SortSelect value={sort} onChange={setSort} options={[["created_at", "Oprettet"], ["address", "Adresse"], ["owner", "Ejer"], ["public_data_status", "BBR"], ["warning_count", "Warnings"], ["task_count", "Opgaver"]]} />
          <OrderButton order={order} setOrder={setOrder} />
        </>
      }
      title="Boliger"
    >
      <ListState state={state} retry={retry} empty="Ingen boliger matcher filtrene.">
        {(data) => (
          <>
            <ResultCount total={data.pagination.total} />
            <div className="table-scroll">
              <table className="data-table houses-table">
                <thead>
                  <tr><th>Adresse</th><th>Ejer</th><th>BBR-status</th><th>Warnings</th><th>Opgaver</th><th>Completions</th><th>Anbefalinger</th><th>Oprettet</th></tr>
                </thead>
                <tbody>
                  {data.houses.map((house) => (
                    <tr key={house.id} onClick={() => onOpen(house.id)}>
                      <td><strong>{house.addressLabel}</strong><span>{house.id}</span></td>
                      <td><strong>{house.owner.displayName ?? house.owner.email}</strong><span>{house.owner.email}</span></td>
                      <td><StatusBadge label={house.publicDataStatus} /></td>
                      <td>{numberFormatter.format(house.warningCount)}</td>
                      <td>{numberFormatter.format(house.taskCount)}</td>
                      <td>{numberFormatter.format(house.completionCount)}</td>
                      <td>{numberFormatter.format(house.activeRecommendationCount)}</td>
                      <td>{formatDate(house.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} setPage={setPage} />
          </>
        )}
      </ListState>
    </DataSection>
  );
}

function RecommendationsList({
  client,
  onAuthorizationError,
  onOpen
}: {
  client: MatrivaApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("catalog_key");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminRecommendationCatalogResponse>(
    (signal) => client.getAdminRecommendationCatalog({ query, active: active as any, category, sort: sort as any, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Anbefalinger kunne ikke indlæses.",
    [client, query, active, category, sort, order, page]
  );
  const categoryOptions = useMemo<Array<[string, string]>>(() => {
    const categories = state.status === "ready" ? state.data.filters.categories : [];
    return [["all", "Alle"] as [string, string], ...categories.map((value) => [value, value] as [string, string])];
  }, [state]);

  return (
    <DataSection
      description="Read-only katalogstatistik. not_now vises ikke som præcis metric."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="Aktiv" value={active} onChange={(value) => { setActive(value); setPage(1); }} options={[["all", "Alle"], ["active", "Aktive"], ["inactive", "Inaktive"]]} />
          <FilterSelect label="Kategori" value={category} onChange={(value) => { setCategory(value); setPage(1); }} options={categoryOptions} />
          <SortSelect value={sort} onChange={setSort} options={[["catalog_key", "Key"], ["title", "Titel"], ["category", "Kategori"], ["instance_count", "Instances"], ["accepted_count", "Accepteret"], ["acceptance_rate", "Rate"]]} />
          <OrderButton order={order} setOrder={setOrder} />
        </>
      }
      title="Anbefalinger"
    >
      <ListState state={state} retry={retry} empty="Ingen anbefalinger matcher filtrene.">
        {(data) => (
          <>
            <ResultCount total={data.pagination.total} />
            <div className="table-scroll">
              <table className="data-table recommendations-table">
                <thead>
                  <tr><th>Anbefaling</th><th>Kategori</th><th>Version</th><th>Aktiv</th><th>Priority</th><th>Instances</th><th>Accepteret</th><th>Skjult permanent</th><th>Acceptance rate</th></tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={`${item.catalogKey}:${item.catalogVersion}`} onClick={() => onOpen(item.catalogKey)}>
                      <td><strong>{item.title}</strong><span>{item.catalogKey}</span></td>
                      <td>{item.category}</td>
                      <td>{item.catalogVersion}</td>
                      <td><StatusBadge label={item.active ? "active" : "inactive"} /></td>
                      <td>{item.priority}</td>
                      <td>{numberFormatter.format(item.instanceCount)}</td>
                      <td>{numberFormatter.format(item.acceptedCount)}</td>
                      <td>{numberFormatter.format(item.permanentHideCount)}</td>
                      <td>{percentFormatter.format(item.acceptanceRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} setPage={setPage} />
          </>
        )}
      </ListState>
    </DataSection>
  );
}

function DetailPage({
  client,
  detail,
  onAuthorizationError,
  onBack
}: {
  client: MatrivaApiClient;
  detail: NonNullable<DetailKey>;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onBack: () => void;
}) {
  const { state, retry } = useListState<
    AdminUserResponse | AdminHouseResponse | AdminRecommendationCatalogItemResponse
  >(
    (signal) => {
      if (detail.section === "houses") return client.getAdminHouse(detail.id, { signal });
      if (detail.section === "recommendations") return client.getAdminRecommendationCatalogItem(detail.id, { signal });
      return client.getAdminUser(detail.id, { signal });
    },
    onAuthorizationError,
    "Detaljen kunne ikke indlæses.",
    [client, detail.section, detail.id]
  );

  return (
    <DataSection title="Detalje" description="Read-only administrativ detaljevisning.">
      <button className="secondary-action" type="button" onClick={onBack}>Tilbage</button>
      <ListState state={state} retry={retry} empty="Detaljen findes ikke.">
        {(data) => <DetailContent data={data} />}
      </ListState>
    </DataSection>
  );
}

function DetailContent({ data }: { data: AdminUserResponse | AdminHouseResponse | AdminRecommendationCatalogItemResponse }) {
  if ("user" in data) {
    const user = data.user;
    return <DetailGrid title={user.displayName ?? user.email} subtitle={user.id} rows={[
      ["Status", user.status], ["E-mail", user.email], ["Onboarding", user.onboardingState], ["Roller", user.roles.join(", ") || "Bruger"], ["Oprettet", formatDate(user.createdAt)], ["Senest aktiv", formatDate(user.latestActivityAt)], ["Boliger", numberFormatter.format(user.houseCount)], ["Opgaver", numberFormatter.format(user.taskSummary.total)], ["Completions", numberFormatter.format(user.completionSummary.total)], ["Anbefalinger", `${user.recommendationSummary.pending} pending / ${user.recommendationSummary.accepted} accepted / ${user.recommendationSummary.permanentHidden} skjult`]
    ]} extra={user.houses.map((house) => `${house.addressLabel} (${house.id})`)} />;
  }
  if ("house" in data) {
    const house = data.house;
    return <DetailGrid title={house.addressLabel} subtitle={house.id} rows={[
      ["Ejer", `${house.owner.displayName ?? house.owner.email} (${house.owner.email})`], ["Status", house.status], ["BBR-status", house.publicDataStatus], ["Warnings", numberFormatter.format(house.warningCount)], ["Data confidence", house.dataConfidence], ["Opgaver", numberFormatter.format(house.taskSummary.total)], ["Completions", numberFormatter.format(house.completionSummary.total)], ["Anbefalinger", `${house.recommendationSummary.active} aktive / ${house.recommendationSummary.permanentHidden} skjult`], ["Dokumenter", numberFormatter.format(house.assetCounts.documents)], ["Forbedringer", numberFormatter.format(house.assetCounts.improvements)], ["Medier", numberFormatter.format(house.assetCounts.media)], ["BBR enheder", numberFormatter.format(house.bbr.unitCount)], ["BBR bygninger", numberFormatter.format(house.bbr.buildings.length)]
    ]} extra={house.bbr.warnings.map((warning) => `${warning.code}: ${warning.message}`)} />;
  }
  const item = data.item;
  return <DetailGrid title={item.title} subtitle={item.catalogKey} rows={[
    ["Version", item.catalogVersion], ["Kategori", item.category], ["Aktiv", item.active ? "Ja" : "Nej"], ["Priority", item.priority], ["Recurrence", item.recurrenceInterval], ["Season", item.season], ["Instances", numberFormatter.format(item.instanceCount)], ["Pending", numberFormatter.format(item.statusDistribution.pending)], ["Accepted", numberFormatter.format(item.statusDistribution.accepted)], ["Dismissed", numberFormatter.format(item.statusDistribution.dismissed)], ["Accepted tasks", numberFormatter.format(item.acceptedTaskCount)], ["Permanent hides", numberFormatter.format(item.permanentHideCount)], ["Acceptance rate", percentFormatter.format(item.acceptanceRate)], ["Accepted over time", "Estimeret via updated_at"], ["not_now", "Ikke tilgængelig som præcis metric"]
  ]} extra={[item.shortDescription]} />;
}

function DetailGrid({ title, subtitle, rows, extra = [] }: { title: string; subtitle: string; rows: Array<[string, string]>; extra?: string[] }) {
  return (
    <section className="detail-panel">
      <header><h3>{title}</h3><span>{subtitle}</span></header>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {extra.length > 0 ? <ul>{extra.map((line) => <li key={line}>{line}</li>)}</ul> : null}
    </section>
  );
}

function DataSection({ children, description, filters, title }: { children: ReactNode; description: string; filters?: ReactNode; title: string }) {
  return <div className="admin-data-page"><section className="data-heading"><div><h2>{title}</h2><p>{description}</p></div></section>{filters ? <section className="data-toolbar">{filters}</section> : null}{children}</div>;
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label>Søg<input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Søg..." /></label>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function SortSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <FilterSelect label="Sortering" value={value} onChange={onChange} options={options} />;
}

function OrderButton({ order, setOrder }: { order: "asc" | "desc"; setOrder: (order: "asc" | "desc") => void }) {
  return <button className="secondary-action" type="button" onClick={() => setOrder(order === "asc" ? "desc" : "asc")}>{order === "asc" ? "Stigende" : "Faldende"}</button>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className={`status-badge status-${label.replaceAll("_", "-")}`}>{label}</span>;
}

function ResultCount({ total }: { total: number }) {
  return <p className="result-count">{numberFormatter.format(total)} resultater</p>;
}

function ListState<T>({ children, empty, retry, state }: { children: (data: T) => ReactNode; empty: string; retry: () => void; state: LoadState<T> }) {
  if (state.status === "loading") return <section className="data-state">Indlæser...</section>;
  if (state.status === "error") return <section className="data-state error"><strong>Kunne ikke indlæse</strong><p>{state.message}</p><button type="button" onClick={retry}>Prøv igen</button></section>;
  const candidate = state.data as any;
  const rows = candidate.users ?? candidate.houses ?? candidate.items;
  if (Array.isArray(rows) && rows.length === 0) return <section className="data-state">{empty}</section>;
  return <>{children(state.data)}</>;
}

function Pagination({ pagination, setPage }: { pagination: { page: number; pageCount: number }; setPage: (page: number) => void }) {
  return <div className="pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Forrige</button><span>Side {pagination.page} af {Math.max(1, pagination.pageCount)}</span><button type="button" disabled={pagination.page >= pagination.pageCount} onClick={() => setPage(pagination.page + 1)}>Næste</button></div>;
}
