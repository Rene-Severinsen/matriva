import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type {
  AdminHouseResponse,
  AdminHouseClaimsResponse,
  AdminHouseInvitationsResponse,
  AdminHouseSort,
  AdminHousesResponse,
  AdminRecommendationCatalogItemResponse,
  AdminRecommendationCatalogResponse,
  AdminRecommendationCatalogSort,
  AdminGuidesResponse,
  AdminUserResponse,
  AdminUserEntitlementResponse,
  AdminUsersResponse,
  AdminUserSort
} from "@matriva/shared";

type SectionKey = "users" | "houses" | "claims" | "recommendations";
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

type SortOrder = "asc" | "desc";
type ClaimSortKey = "user" | "house" | "bfe" | "type" | "status" | "requestedAt";
type InvitationSortKey = "house" | "email" | "invitedBy" | "role" | "status" | "createdAt" | "expiresAt" | "acceptedBy";

function compareSortValues(left: string | number | null, right: string | number | null) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""), "da-DK", { numeric: true, sensitivity: "base" });
}

function sortRows<T>(rows: T[], order: SortOrder, value: (row: T) => string | number | null) {
  return [...rows].sort((left, right) => {
    const comparison = compareSortValues(value(left), value(right));
    return order === "asc" ? comparison : -comparison;
  });
}

function changeLocalSort<T extends string>(currentSort: T, currentOrder: SortOrder, setSort: (sort: T) => void, setOrder: (order: SortOrder) => void) {
  return (nextSort: T) => {
    if (currentSort === nextSort) {
      setOrder(currentOrder === "asc" ? "desc" : "asc");
    } else {
      setSort(nextSort);
      setOrder("asc");
    }
  };
}

function claimSortValue(claim: AdminHouseClaimsResponse["claims"][number], sortKey: ClaimSortKey) {
  switch (sortKey) {
    case "user": return claim.userDisplayName ?? claim.userEmail;
    case "house": return claim.addressLabel;
    case "bfe": return claim.bfeNumber;
    case "type": return claim.claimType;
    case "status": return claim.status;
    case "requestedAt": return new Date(claim.requestedAt).getTime();
  }
}

function invitationSortValue(invitation: AdminHouseInvitationsResponse["invitations"][number], sortKey: InvitationSortKey) {
  switch (sortKey) {
    case "house": return invitation.addressLabel;
    case "email": return invitation.email;
    case "invitedBy": return invitation.invitedByDisplayName ?? invitation.invitedByEmail;
    case "role": return invitation.role;
    case "status": return invitation.status;
    case "createdAt": return new Date(invitation.createdAt).getTime();
    case "expiresAt": return new Date(invitation.expiresAt).getTime();
    case "acceptedBy": return invitation.acceptedByDisplayName ?? invitation.acceptedByEmail;
  }
}

export function AdminDataPage({
  client,
  detail,
  onAuthorizationError,
  onOpenDetail,
  section
}: {
  client: MatrivaAdminApiClient;
  detail: DetailKey;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpenDetail: (section: SectionKey, id?: string) => void;
  section: SectionKey;
}) {
  if (detail) {
    if (detail.section === "claims") {
      return <ClaimDetail client={client} claimId={detail.id} onBack={() => onOpenDetail("claims")} onAuthorizationError={onAuthorizationError} />;
    }
    return (
      <DetailPage
        client={client}
        detail={detail}
        onAuthorizationError={onAuthorizationError}
        onBack={() => onOpenDetail(detail.section)}
        onOpenDetail={onOpenDetail}
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

  if (section === "claims") {
    return <AccessRequirementsPage client={client} onAuthorizationError={onAuthorizationError} onOpenClaim={(id) => onOpenDetail("claims", id)} />;
  }

  return (
    <UsersList
      client={client}
      onAuthorizationError={onAuthorizationError}
      onOpen={(id) => onOpenDetail("users", id)}
    />
  );
}

function AccessRequirementsPage({ client, onAuthorizationError, onOpenClaim }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean>; onOpenClaim: (id: string) => void }) {
  const [tab, setTab] = useState<"claims" | "invitations">("claims");
  return <>
    <div className="data-tabs" role="tablist" aria-label="Adgangskrav">
      <button className={tab === "claims" ? "secondary-action active" : "secondary-action"} type="button" role="tab" aria-selected={tab === "claims"} onClick={() => setTab("claims")}>Adgangsanmodninger</button>
      <button className={tab === "invitations" ? "secondary-action active" : "secondary-action"} type="button" role="tab" aria-selected={tab === "invitations"} onClick={() => setTab("invitations")}>Invitationer</button>
    </div>
    {tab === "claims" ? <ClaimsList client={client} onAuthorizationError={onAuthorizationError} onOpen={onOpenClaim} /> : <InvitationsList client={client} onAuthorizationError={onAuthorizationError} />}
  </>;
}

function ClaimsList({ client, onAuthorizationError, onOpen }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean>; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [sortKey, setSortKey] = useState<ClaimSortKey>("requestedAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { state, retry } = useListState<AdminHouseClaimsResponse>((signal) => client.getAdminHouseClaims({ status, signal }), onAuthorizationError, "Adgangskrav kunne ikke indlæses.", [client, status]);
  return <DataSection title="Adgangskrav" description="Adgangskrav mellem brugere og fysiske ejendomme." filters={<FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as typeof status)} options={[["pending", "Afventer"], ["approved", "Godkendt"], ["rejected", "Afvist"], ["all", "Alle"]]} />}>
    <ListState state={state} retry={retry} empty="Ingen adgangskrav matcher filteret.">{(data) => <div className="table-scroll"><table className="data-table"><thead><tr><SortableHeader label="Bruger" sortKey="user" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Bolig" sortKey="house" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="BFE" sortKey="bfe" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Type" sortKey="type" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Status" sortKey="status" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Anmodet" sortKey="requestedAt" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /></tr></thead><tbody>{sortRows(data.claims, sortOrder, (claim) => claimSortValue(claim, sortKey)).map((claim) => <tr key={claim.id} onClick={() => onOpen(claim.id)}><td><strong>{claim.userDisplayName ?? "Navn mangler"}</strong><span>{claim.userEmail}</span></td><td>{claim.addressLabel}</td><td>{claim.bfeNumber ?? "Ikke registreret"}</td><td>{claim.claimType}</td><td><StatusBadge label={claim.status} /></td><td>{formatDate(claim.requestedAt)}</td></tr>)}</tbody></table></div>}</ListState>
  </DataSection>;
}

const invitationStatusLabels = { pending: "Afventer", accepted: "Accepteret", expired: "Udløbet", revoked: "Tilbagekaldt" } as const;

function InvitationsList({ client, onAuthorizationError }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [status, setStatus] = useState<"all" | "pending" | "accepted" | "expired" | "revoked">("all");
  const [sortKey, setSortKey] = useState<InvitationSortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const { state, retry } = useListState<AdminHouseInvitationsResponse>((signal) => client.getAdminHouseInvitations({ status, signal }), onAuthorizationError, "Invitationer kunne ikke indlæses.", [client, status]);
  return <DataSection title="Invitationer" description="Invitationer til boliger, adskilt fra adgangsanmodninger." filters={<FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as typeof status)} options={[["all", "Alle"], ["pending", "Afventer"], ["accepted", "Accepteret"], ["expired", "Udløbet"], ["revoked", "Tilbagekaldt"]]} />}>
    <ListState state={state} retry={retry} empty="Ingen invitationer matcher filteret.">{(data) => <div className="table-scroll"><table className="data-table"><thead><tr><SortableHeader label="Bolig" sortKey="house" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Inviteret e-mail" sortKey="email" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Inviteret af" sortKey="invitedBy" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Rolle" sortKey="role" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Status" sortKey="status" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Oprettet" sortKey="createdAt" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Udløber" sortKey="expiresAt" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /><SortableHeader label="Accepteret af" sortKey="acceptedBy" currentSort={sortKey} order={sortOrder} onSort={changeLocalSort(sortKey, sortOrder, setSortKey, setSortOrder)} onPageReset={() => undefined} /></tr></thead><tbody>{sortRows(data.invitations, sortOrder, (invitation) => invitationSortValue(invitation, sortKey)).map((invitation) => <tr key={invitation.id}><td><strong>{invitation.addressLabel}</strong><span>{invitation.bfeNumber ?? "BFE ikke registreret"}</span></td><td>{invitation.email}</td><td><strong>{invitation.invitedByDisplayName ?? "Navn mangler"}</strong><span>{invitation.invitedByEmail}</span></td><td>{invitation.role === "owner" ? "Ejer" : "Medlem"}</td><td><StatusBadge label={invitationStatusLabels[invitation.status]} /></td><td>{formatDate(invitation.createdAt)}</td><td>{formatDate(invitation.expiresAt)}</td><td>{invitation.acceptedByDisplayName ?? invitation.acceptedByEmail ?? "Ikke accepteret"}</td></tr>)}</tbody></table></div>}</ListState>
  </DataSection>;
}

function ClaimDetail({ client, claimId, onBack, onAuthorizationError }: { client: MatrivaAdminApiClient; claimId: string; onBack: () => void; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [state, setState] = useState<LoadState<AdminHouseClaimsResponse>>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void client.getAdminHouseClaims({ status: "all" }).then((data) => setState({ status: "ready", data })).catch(async (error) => { if (!(await onAuthorizationError(error))) setState({ status: "error", message: errorMessage(error, "Adgangskrav kunne ikke indlæses.") }); }); }, [client, claimId, onAuthorizationError]);
  if (state.status !== "ready") return <DataSection title="Adgangskrav" description=""><ListState state={state} retry={() => setState({ status: "loading" })} empty="Adgangskravet blev ikke fundet.">{() => null}</ListState></DataSection>;
  const claim = state.data.claims.find((item) => item.id === claimId);
  if (!claim) return <DataSection title="Adgangskrav" description=""><p>Adgangskravet blev ikke fundet.</p><button type="button" onClick={onBack}>Tilbage</button></DataSection>;
  const selectedClaim = claim;
  async function resolve(decision: "approve" | "reject") { setBusy(true); try { await client.resolveAdminHouseClaim(selectedClaim.id, decision); const data = await client.getAdminHouseClaims({ status: "all" }); setState({ status: "ready", data }); } finally { setBusy(false); } }
  return <DataSection title="Adgangskrav" description="Detaljer og server-validerede handlinger."><DetailGrid title={claim.userDisplayName ?? claim.userEmail} subtitle={claim.addressLabel} rows={[["E-mail", claim.userEmail], ["BFE", claim.bfeNumber ?? "Ikke registreret"], ["Claim-type", claim.claimType], ["Status", claim.status], ["Anmodet", formatDate(claim.requestedAt)], ["Verification", claim.verificationMethod ?? "Ikke registreret"]]} extra={claim.resolutionNote ? [claim.resolutionNote] : []} />{claim.status === "pending" ? <div className="detail-actions"><button type="button" disabled={busy} onClick={() => void resolve("approve")}>Godkend adgang</button><button type="button" disabled={busy} onClick={() => void resolve("reject")}>Afvis adgang</button></div> : null}<button type="button" onClick={onBack}>Tilbage</button></DataSection>;
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
  client: MatrivaAdminApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<AdminUserSort>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminUsersResponse>(
    (signal) => client.getAdminUsers({ query, status: status as any, sort, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Brugere kunne ikke indlæses.",
    [client, query, status, sort, order, page]
  );

  return (
    <DataSection
      description="Oversigt over registrerede brugere og deres boligrelationer."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="Status" value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[["all", "Alle"], ["active", "Aktive"], ["disabled", "Disabled"]]} />
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
                  <tr>
                    <SortableHeader label="Bruger" sortKey="display_name" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Status" sortKey="status" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Abonnement" sortKey="subscription_plan" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Aktive boliger" sortKey="house_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Åbne adgangskrav" sortKey="pending_claim_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Opgaver" sortKey="task_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Fuldførte" sortKey="completion_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Rolle" sortKey="roles" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Oprettet" sortKey="created_at" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                    <SortableHeader label="Senest aktiv" sortKey="latest_session_activity" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} />
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} onClick={() => onOpen(user.id)}>
                      <td><strong>{user.displayName ?? "Navn mangler"}</strong><span>{user.email}</span></td>
                      <td><StatusBadge label={user.status} /></td>
                      <td><span className={`status-badge subscription-badge subscription-${user.subscriptionSource}`}>{subscriptionLabel(user.subscriptionPlan, user.subscriptionSource)}</span></td>
                      <td>{numberFormatter.format(user.houseCount)}</td>
                      <td>{numberFormatter.format(user.pendingClaimCount)}</td>
                      <td>{numberFormatter.format(user.taskCount)}</td>
                      <td>{numberFormatter.format(user.completionCount)}</td>
                      <td>{user.roles.join(", ") || "Bruger"}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.latestSessionActivityAt ?? user.lastLoginAt)}</td>
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
  client: MatrivaAdminApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [publicDataStatus, setPublicDataStatus] = useState("all");
  const [sort, setSort] = useState<AdminHouseSort>("created_at");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminHousesResponse>(
    (signal) => client.getAdminHouses({ query, publicDataStatus: publicDataStatus as any, sort: sort as any, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Boliger kunne ikke indlæses.",
    [client, query, publicDataStatus, sort, order, page]
  );

  return (
    <DataSection
      description="Én række pr. fysisk ejendom med BFE, brugere og BBR-status."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="BBR" value={publicDataStatus} onChange={(value) => { setPublicDataStatus(value); setPage(1); }} options={[["all", "Alle"], ["success", "Success"], ["partial", "Partial"], ["with_warnings", "Warnings"], ["not_started", "Ikke startet"], ["failed", "Fejlet"]]} />
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
                  <tr><SortableHeader label="Adresse" sortKey="address" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="BFE" sortKey="bfe_number" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Brugere" sortKey="active_user_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Åbne krav" sortKey="open_claim_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="BBR-status" sortKey="public_data_status" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Warnings" sortKey="warning_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Opgaver" sortKey="task_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Completions" sortKey="completion_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Oprettet" sortKey="created_at" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /></tr>
                </thead>
                <tbody>
                  {data.houses.map((house) => (
                    <tr key={house.id} onClick={() => onOpen(house.id)}>
                      <td><strong>{house.addressLabel}</strong><span>{house.id}</span></td>
                      <td>{house.bfeNumber ?? "Ikke registreret"}</td>
                      <td>{numberFormatter.format(house.activeUserCount)}</td>
                      <td>{numberFormatter.format(house.openClaimCount)}</td>
                      <td><StatusBadge label={house.publicDataStatus} /></td>
                      <td>{numberFormatter.format(house.warningCount)}</td>
                      <td>{numberFormatter.format(house.taskCount)}</td>
                      <td>{numberFormatter.format(house.completionCount)}</td>
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
  client: MatrivaAdminApiClient;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("all");
  const [sort, setSort] = useState<AdminRecommendationCatalogSort>("catalog_key");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const { state, retry } = useListState<AdminRecommendationCatalogResponse>(
    (signal) => client.getAdminRecommendationCatalog({ query, active: active as any, sort: sort as any, order, page, pageSize: 25, signal }),
    onAuthorizationError,
    "Anbefalinger kunne ikke indlæses.",
    [client, query, active, sort, order, page]
  );

  return (
    <DataSection
      description="Read-only katalogstatistik. not_now vises ikke som præcis metric."
      filters={
        <>
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} />
          <FilterSelect label="Aktiv" value={active} onChange={(value) => { setActive(value); setPage(1); }} options={[["all", "Alle"], ["active", "Aktive"], ["inactive", "Inaktive"]]} />
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
                  <tr><SortableHeader label="Anbefaling" sortKey="title" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Version" sortKey="catalog_version" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Aktiv" sortKey="active" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Priority" sortKey="priority" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Instances" sortKey="instance_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Accepteret" sortKey="accepted_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Skjult permanent" sortKey="permanent_hide_count" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /><SortableHeader label="Acceptance rate" sortKey="acceptance_rate" currentSort={sort} order={order} onSort={setSort} onOrder={setOrder} onPageReset={() => setPage(1)} /></tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={`${item.catalogKey}:${item.catalogVersion}`} onClick={() => onOpen(item.catalogKey)}>
                      <td><strong>{item.title}</strong><span>{item.catalogKey}</span></td>
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
  onBack,
  onOpenDetail
}: {
  client: MatrivaAdminApiClient;
  detail: NonNullable<DetailKey>;
  onAuthorizationError: (error: unknown) => Promise<boolean>;
  onBack: () => void;
  onOpenDetail: (section: SectionKey, id?: string) => void;
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
        {(data) => <DetailContent data={data} client={client} onAuthorizationError={onAuthorizationError} onOpenDetail={onOpenDetail} />}
      </ListState>
    </DataSection>
  );
}

function DetailContent({ data, client, onAuthorizationError, onOpenDetail }: { data: AdminUserResponse | AdminHouseResponse | AdminRecommendationCatalogItemResponse; client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean>; onOpenDetail: (section: SectionKey, id?: string) => void }) {
  if ("user" in data) {
    const user = data.user;
    return <><DetailGrid title={user.displayName ?? user.email} subtitle={user.id} rows={[
      ["Status", user.status], ["E-mail", user.email], ["Onboarding", user.onboardingState], ["Roller", user.roles.join(", ") || "Bruger"], ["Oprettet", formatDate(user.createdAt)], ["Senest aktiv", formatDate(user.latestActivityAt)], ["Boliger", numberFormatter.format(user.houseCount)], ["Opgaver", numberFormatter.format(user.taskSummary.total)], ["Completions", numberFormatter.format(user.completionSummary.total)], ["Anbefalinger", `${user.recommendationSummary.pending} pending / ${user.recommendationSummary.accepted} accepted / ${user.recommendationSummary.permanentHidden} skjult`]
    ]} extra={[...user.memberships.map((membership) => <button type="button" key={`${membership.houseId}:${membership.validFrom}`} onClick={() => onOpenDetail("houses", membership.houseId)}>{membership.addressLabel} · {membership.role} · {membership.status}</button>), `Åbne adgangskrav: ${user.pendingClaimCount}`]} /><UserEntitlementPanel client={client} userId={user.id} onAuthorizationError={onAuthorizationError} /></>;
  }
  if ("house" in data) {
    const house = data.house;
    return <DetailGrid title={house.addressLabel} subtitle={house.id} rows={[
      ["BFE", house.bfeNumber ?? "Ikke registreret"], ["Brugere", numberFormatter.format(house.activeUserCount)], ["Åbne adgangskrav", numberFormatter.format(house.openClaimCount)], ["Status", house.status], ["BBR-status", house.publicDataStatus], ["Warnings", numberFormatter.format(house.warningCount)], ["Opgaver", numberFormatter.format(house.taskSummary.total)], ["Completions", numberFormatter.format(house.completionSummary.total)], ["Anbefalinger", `${house.recommendationSummary.active} aktive / ${house.recommendationSummary.permanentHidden} skjult`], ["Dokumenter", numberFormatter.format(house.assetCounts.documents)], ["Forbedringer", numberFormatter.format(house.assetCounts.improvements)], ["Medier", numberFormatter.format(house.assetCounts.media)], ["BBR enheder", numberFormatter.format(house.bbr.unitCount)], ["BBR bygninger", numberFormatter.format(house.bbr.buildings.length)]
    ]} extra={[...house.members.map((member) => <button type="button" key={member.userId} onClick={() => onOpenDetail("users", member.userId)}>{member.displayName ?? member.email} · {member.role} · {member.status}</button>), ...house.invitations.map((invitation) => `Invitation: ${invitation.email} · ${invitation.status}`), ...house.claims.map((claim) => <button type="button" key={claim.id} onClick={() => onOpenDetail("claims", claim.id)}>Adgangskrav: {claim.claimType} · {claim.status}</button>), ...house.bbr.warnings.map((warning) => `${warning.code}: ${warning.message}`)]} />;
  }
  const item = data.item;
  return <><DetailGrid title={item.title} subtitle={item.catalogKey} rows={[
    ["Version", item.catalogVersion], ["Aktiv", item.active ? "Ja" : "Nej"], ["Prioritet", item.priority], ["Gentagelse", item.recurrenceInterval], ["Sæson", item.season], ["Forekomster", numberFormatter.format(item.instanceCount)], ["Afventer", numberFormatter.format(item.statusDistribution.pending)], ["Accepteret", numberFormatter.format(item.acceptedCount)], ["Afvist", numberFormatter.format(item.statusDistribution.dismissed)], ["Accepterede opgaver", numberFormatter.format(item.acceptedTaskCount)], ["Permanent skjult", numberFormatter.format(item.permanentHideCount)], ["Accept-rate", percentFormatter.format(item.acceptanceRate)]
  ]} extra={[item.shortDescription]} /><RecommendationGuidePanel client={client} item={item} onAuthorizationError={onAuthorizationError} /></>;
}

function RecommendationGuidePanel({ client, item, onAuthorizationError }: { client: MatrivaAdminApiClient; item: AdminRecommendationCatalogItemResponse["item"]; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [guides, setGuides] = useState<AdminGuidesResponse | null>(null);
  const [selectedGuideVersionId, setSelectedGuideVersionId] = useState(item.guideVersionId ?? "");
  const [savedGuideVersionId, setSavedGuideVersionId] = useState(item.guideVersionId ?? "");
  const [savedGuideLinkAudit, setSavedGuideLinkAudit] = useState(item.guideLinkAudit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void client.getAdminGuides({ status: "all" }).then(setGuides).catch(async (error) => {
      if (!(await onAuthorizationError(error))) setMessage(errorMessage(error, "Vejledninger kunne ikke indlæses."));
    });
  }, [client, onAuthorizationError]);

  async function save() {
    const guide = guides?.guides.find((candidate) => candidate.versionId === selectedGuideVersionId) ?? null;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await client.updateAdminRecommendationGuide(item.catalogKey, {
        guideTemplateId: guide?.id ?? null,
        guideVersionId: guide?.versionId ?? null
      });
      setSavedGuideVersionId(updated.item.guideVersionId ?? "");
      setSavedGuideLinkAudit(updated.item.guideLinkAudit);
      if (selectedGuideVersionId && !updated.item.guideVersionId) {
        setMessage("Vejledningen kunne ikke kobles. Vælg en aktiv kladde eller udgivet version.");
      } else {
        setMessage("Vejledningen er koblet til anbefalingen.");
      }
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(errorMessage(error, "Koblingen kunne ikke gemmes."));
    } finally {
      setSaving(false);
    }
  }

  const savedGuide = guides?.guides.find((guide) => guide.versionId === savedGuideVersionId) ?? null;
  const guideLabel = savedGuide ? `${savedGuide.title} · v${savedGuide.version} · ${savedGuide.status === "published" ? "Udgivet" : savedGuide.status === "draft" ? "Kladde" : "Arkiveret"}` : "Ingen vejledning";
  const guideAuditLabel = savedGuideLinkAudit ? `${formatDate(savedGuideLinkAudit.savedAt)} · ${savedGuideLinkAudit.savedByLabel ?? "Bruger ikke registreret"}` : "Ikke registreret";

  return <section className="detail-panel recommendation-guide-panel"><header><div><h3>Vejledning til anbefaling</h3><p>Kobl vejledningen til anbefalingen, mens den er en kladde. Koblingen skal være på plads, før vejledningen kan udgives.</p></div></header><div className="recommendation-guide-form"><select aria-label="Vælg vejledning" disabled={saving || !guides} value={selectedGuideVersionId} onChange={(event) => setSelectedGuideVersionId(event.target.value)}><option value="">Vælg vejledning...</option>{guides?.guides.map((guide) => <option key={guide.versionId} value={guide.versionId}>{guide.title} · v{guide.version} · {guide.status === "published" ? "Udgivet" : guide.status === "draft" ? "Kladde" : "Arkiveret"}</option>)}</select><button className="primary-action" disabled={saving || !guides} onClick={() => void save()} type="button">{saving ? "Gemmer..." : "Gem kobling"}</button><div className="recommendation-guide-saved"><span>Senest gemt</span><strong>{guideLabel}</strong><small>{guideAuditLabel}</small></div></div>{message ? <p className="state-message">{message}</p> : null}</section>;
}

function UserEntitlementPanel({ client, userId, onAuthorizationError }: { client: MatrivaAdminApiClient; userId: string; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const { state, retry } = useListState<AdminUserEntitlementResponse>(() => client.getAdminUserEntitlements(userId), onAuthorizationError, "Entitlement-status kunne ikke indlæses.", [client, userId]);
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro">("free");
  const [grantMode, setGrantMode] = useState<"none" | "permanent" | "until">("none");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (state.status !== "ready") return;
    const { entitlements } = state.data.entitlement;
    setSelectedPlan(entitlements.configuredPlan);
    setGrantMode(entitlements.complimentaryProGrant ? entitlements.expiresAt ? "until" : "permanent" : "none");
    setExpiryDate(entitlements.expiresAt ? entitlements.expiresAt.slice(0, 10) : "");
    setReason(entitlements.complimentaryProGrant?.reason ?? "");
  }, [state.status, state.status === "ready" ? state.data.entitlement.entitlements.evaluatedAt : null]);
  if (state.status === "loading") return <section className="detail-panel"><p>Indlæser entitlement-status...</p></section>;
  if (state.status === "error") return <section className="detail-panel"><p>{state.message}</p></section>;
  const { entitlements, overLimit } = state.data.entitlement;
  const isComplimentaryPro = entitlements.configuredPlan === "pro" && entitlements.source === "complimentary";
  const isStandardPro = entitlements.configuredPlan === "pro" && (entitlements.source === "admin" || entitlements.source === "subscription" || entitlements.source === "billing");
  const grant = entitlements.complimentaryProGrant;
  async function savePlan() {
    setSaving(true);
    setMessage(null);
    try {
      await client.updateAdminUserEntitlement(userId, { action: "set_plan", plan: selectedPlan });
      setMessage(`Planen er sat til ${selectedPlan === "pro" ? "PRO" : "Free"}.`);
      retry();
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(errorMessage(error, "Planen kunne ikke gemmes."));
    } finally {
      setSaving(false);
    }
  }
  async function saveGrant() {
    setSaving(true);
    setMessage(null);
    try {
      if (grantMode === "none") {
        setMessage("Vælg permanent eller tidsbegrænset Gratis PRO.");
        return;
      }
      if (grantMode === "until" && !expiryDate) {
        setMessage("Vælg en udløbsdato for tidsbegrænset Gratis PRO.");
        return;
      }
      await client.updateAdminUserEntitlement(userId, {
        action: "grant_complimentary_pro",
        expiresAt: grantMode === "permanent" ? null : new Date(`${expiryDate}T23:59:59.999Z`).toISOString(),
        reason: reason.trim()
      });
      setMessage(isComplimentaryPro ? "Gratis PRO er ændret." : "Gratis PRO er tildelt.");
      retry();
    } catch (error) {
      if (!(await onAuthorizationError(error))) {
        setMessage(errorMessage(error, "Abonnementet kunne ikke gemmes."));
      }
    } finally {
      setSaving(false);
    }
  }
  async function removeGrant() {
    setSaving(true);
    setMessage(null);
    try {
      await client.updateAdminUserEntitlement(userId, { action: "remove_complimentary_pro" });
      setMessage("Gratis PRO er fjernet. Brugerens data er bevaret.");
      retry();
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(errorMessage(error, "Gratis PRO kunne ikke fjernes."));
    } finally {
      setSaving(false);
    }
  }

  return <><DetailGrid title="Entitlement-status" subtitle="Backend-evalueret adgang og forbrug" rows={[
    ["Plan", `${entitlements.plan} (konfigureret: ${entitlements.configuredPlan})`],
    ["Status", entitlements.status],
    ["Adgangskilde", subscriptionLabel(entitlements.configuredPlan, entitlements.source)],
    ["Gratis PRO udløber", entitlements.expiresAt ? formatDate(entitlements.expiresAt) : isComplimentaryPro ? "Permanent" : "Ikke relevant"],
    ...(grant ? [["Givet", `${formatDate(grant.grantedAt)} · ${grant.grantedByUserId ?? "ukendt admin"}`] as [string, string], ["Intern årsag", grant.reason] as [string, string]] : []),
    ["Boliger", `${entitlements.usage.houses.active}/${entitlements.usage.houses.limit ?? "∞"}`],
    ["Dokumenter", `${entitlements.usage.documents.active}/${entitlements.usage.documents.limit ?? "∞"}`],
    ["Dokumentlager", `${Math.round(entitlements.usage.documents.storageBytes / 1024 / 1024 * 10) / 10}/${entitlements.usage.documents.storageLimitBytes === null ? "∞" : Math.round(entitlements.usage.documents.storageLimitBytes / 1024 / 1024)} MB`],
    ["Egne aktive opgaver", `${entitlements.usage.tasks.active}/${entitlements.usage.tasks.limit ?? "∞"}`],
    ["Over limit efter downgrade", overLimit.length ? overLimit.join(", ") : "Nej"]
  ]} /><section className="detail-panel subscription-panel"><header><h3>Abonnement</h3><span>Den almindelige produktplan</span></header><div className="subscription-controls"><label>Plan<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as "free" | "pro")}><option value="free">Free</option><option value="pro">PRO</option></select></label><button className="primary-action" disabled={saving || selectedPlan === entitlements.configuredPlan} onClick={() => void savePlan()} type="button">{saving ? "Gemmer..." : "Gem plan"}</button></div></section><section className="detail-panel subscription-panel complimentary-panel"><header><h3>Gratis PRO</h3><span>Valgfri tildeling oven på planmodellen</span></header>{isStandardPro ? <p className="state-message">Brugeren har almindelig PRO. Gratis PRO er ikke nødvendig.</p> : <><div className="subscription-controls"><label>Gratis adgang<select value={grantMode} onChange={(event) => setGrantMode(event.target.value as "none" | "permanent" | "until")}><option value="none">Ingen tildeling</option><option value="permanent">Permanent</option><option value="until">Tidsbegrænset</option></select></label>{grantMode === "until" ? <label>Udløbsdato<input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label> : null}<label className="subscription-reason">Intern årsag<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Fx familie eller nær ven" /></label><button className="primary-action" disabled={saving || grantMode === "none" || reason.trim().length === 0} onClick={() => void saveGrant()} type="button">{saving ? "Gemmer..." : isComplimentaryPro ? "Gem Gratis PRO" : "Giv Gratis PRO"}</button>{isComplimentaryPro ? <button className="secondary-action" disabled={saving} onClick={() => void removeGrant()} type="button">Fjern Gratis PRO</button> : null}</div>{isComplimentaryPro ? <p className="form-hint">Gratis PRO bruger præcis samme feature-entitlements som PRO.</p> : null}</>}</section>{message ? <p className="state-message">{message}</p> : null}</>;
}

function subscriptionLabel(plan: "free" | "pro", source: "default" | "admin" | "subscription" | "complimentary" | "billing") {
  if (plan !== "pro") return "Free";
  if (source === "complimentary") return "Gratis PRO";
  return "PRO";
}

function DetailGrid({ title, subtitle, rows, extra = [] }: { title: string; subtitle: string; rows: Array<[string, string]>; extra?: ReactNode[] }) {
  return (
    <section className="detail-panel">
      <header><h3>{title}</h3><span>{subtitle}</span></header>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {extra.length > 0 ? <ul>{extra.map((line, index) => <li key={index}>{line}</li>)}</ul> : null}
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

function SortableHeader<T extends string>({ label, sortKey, currentSort, order, onSort, onOrder, onPageReset }: { label: string; sortKey: T; currentSort: T; order: SortOrder; onSort: (sort: T) => void; onOrder?: (order: SortOrder) => void; onPageReset: () => void }) {
  const active = currentSort === sortKey;
  function handleSort() {
    if (active) {
      if (onOrder) {
        onOrder(order === "asc" ? "desc" : "asc");
      } else {
        onSort(sortKey);
      }
    } else {
      onSort(sortKey);
      onOrder?.("asc");
    }
    onPageReset();
  }

  return <th aria-sort={active ? order === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button${active ? " active" : ""}`} onClick={handleSort} type="button"><span>{label}</span><span className="table-sort-indicator" aria-hidden="true">{active ? order === "asc" ? "↑" : "↓" : "↕"}</span></button></th>;
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
  const rows = candidate.users ?? candidate.houses ?? candidate.items ?? candidate.claims ?? candidate.invitations;
  if (Array.isArray(rows) && rows.length === 0) return <section className="data-state">{empty}</section>;
  return <>{children(state.data)}</>;
}

function Pagination({ pagination, setPage }: { pagination: { page: number; pageCount: number }; setPage: (page: number) => void }) {
  return <div className="pagination"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Forrige</button><span>Side {pagination.page} af {Math.max(1, pagination.pageCount)}</span><button type="button" disabled={pagination.page >= pagination.pageCount} onClick={() => setPage(pagination.page + 1)}>Næste</button></div>;
}
