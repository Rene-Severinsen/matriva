import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type {
  AdminHouseResponse,
  AdminHouseClaimsResponse,
  AdminHouseInvitationsResponse,
  AdminHousesResponse,
  AdminRecommendationCatalogItemResponse,
  AdminRecommendationCatalogResponse,
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
  const { state, retry } = useListState<AdminHouseClaimsResponse>((signal) => client.getAdminHouseClaims({ status, signal }), onAuthorizationError, "Adgangskrav kunne ikke indlæses.", [client, status]);
  return <DataSection title="Adgangskrav" description="Adgangskrav mellem brugere og fysiske ejendomme." filters={<FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as typeof status)} options={[["pending", "Afventer"], ["approved", "Godkendt"], ["rejected", "Afvist"], ["all", "Alle"]]} />}>
    <ListState state={state} retry={retry} empty="Ingen adgangskrav matcher filteret.">{(data) => <div className="table-scroll"><table className="data-table"><thead><tr><th>Bruger</th><th>Bolig</th><th>BFE</th><th>Type</th><th>Status</th><th>Anmodet</th></tr></thead><tbody>{data.claims.map((claim) => <tr key={claim.id} onClick={() => onOpen(claim.id)}><td><strong>{claim.userDisplayName ?? "Navn mangler"}</strong><span>{claim.userEmail}</span></td><td>{claim.addressLabel}</td><td>{claim.bfeNumber ?? "Ikke registreret"}</td><td>{claim.claimType}</td><td><StatusBadge label={claim.status} /></td><td>{formatDate(claim.requestedAt)}</td></tr>)}</tbody></table></div>}</ListState>
  </DataSection>;
}

const invitationStatusLabels = { pending: "Afventer", accepted: "Accepteret", expired: "Udløbet", revoked: "Tilbagekaldt" } as const;

function InvitationsList({ client, onAuthorizationError }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [status, setStatus] = useState<"all" | "pending" | "accepted" | "expired" | "revoked">("all");
  const { state, retry } = useListState<AdminHouseInvitationsResponse>((signal) => client.getAdminHouseInvitations({ status, signal }), onAuthorizationError, "Invitationer kunne ikke indlæses.", [client, status]);
  return <DataSection title="Invitationer" description="Invitationer til boliger, adskilt fra adgangsanmodninger." filters={<FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as typeof status)} options={[["all", "Alle"], ["pending", "Afventer"], ["accepted", "Accepteret"], ["expired", "Udløbet"], ["revoked", "Tilbagekaldt"]]} />}>
    <ListState state={state} retry={retry} empty="Ingen invitationer matcher filteret.">{(data) => <div className="table-scroll"><table className="data-table"><thead><tr><th>Bolig</th><th>Inviteret e-mail</th><th>Inviteret af</th><th>Rolle</th><th>Status</th><th>Oprettet</th><th>Udløber</th><th>Accepteret af</th></tr></thead><tbody>{data.invitations.map((invitation) => <tr key={invitation.id}><td><strong>{invitation.addressLabel}</strong><span>{invitation.bfeNumber ?? "BFE ikke registreret"}</span></td><td>{invitation.email}</td><td><strong>{invitation.invitedByDisplayName ?? "Navn mangler"}</strong><span>{invitation.invitedByEmail}</span></td><td>{invitation.role === "owner" ? "Ejer" : "Medlem"}</td><td><StatusBadge label={invitationStatusLabels[invitation.status]} /></td><td>{formatDate(invitation.createdAt)}</td><td>{formatDate(invitation.expiresAt)}</td><td>{invitation.acceptedByDisplayName ?? invitation.acceptedByEmail ?? "Ikke accepteret"}</td></tr>)}</tbody></table></div>}</ListState>
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
                      <td><span className={`status-badge subscription-badge subscription-${user.subscriptionPlan}`}>{user.subscriptionPlan === "pro" ? "Paid / Pro" : "Free"}</span></td>
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
      description="Én række pr. fysisk ejendom med BFE, brugere og BBR-status."
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
                  <tr><th>Adresse</th><th>BFE</th><th>Brugere</th><th>Åbne krav</th><th>BBR-status</th><th>Warnings</th><th>Opgaver</th><th>Completions</th><th>Oprettet</th></tr>
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
  const [sort, setSort] = useState("catalog_key");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
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
          <SortSelect value={sort} onChange={setSort} options={[["catalog_key", "Key"], ["title", "Titel"], ["instance_count", "Instances"], ["accepted_count", "Accepteret"], ["acceptance_rate", "Rate"]]} />
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
                  <tr><th>Anbefaling</th><th>Version</th><th>Aktiv</th><th>Priority</th><th>Instances</th><th>Accepteret</th><th>Skjult permanent</th><th>Acceptance rate</th></tr>
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
  return <DetailGrid title={item.title} subtitle={item.catalogKey} rows={[
    ["Version", item.catalogVersion], ["Aktiv", item.active ? "Ja" : "Nej"], ["Priority", item.priority], ["Recurrence", item.recurrenceInterval], ["Season", item.season], ["Instances", numberFormatter.format(item.instanceCount)], ["Pending", numberFormatter.format(item.statusDistribution.pending)], ["Accepted", numberFormatter.format(item.statusDistribution.accepted)], ["Dismissed", numberFormatter.format(item.statusDistribution.dismissed)], ["Accepted tasks", numberFormatter.format(item.acceptedTaskCount)], ["Permanent hides", numberFormatter.format(item.permanentHideCount)], ["Acceptance rate", percentFormatter.format(item.acceptanceRate)], ["Accepted over time", "Estimeret via updated_at"], ["not_now", "Ikke tilgængelig som præcis metric"]
  ]} extra={[item.shortDescription]} />;
}

function UserEntitlementPanel({ client, userId, onAuthorizationError }: { client: MatrivaAdminApiClient; userId: string; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const { state, retry } = useListState<AdminUserEntitlementResponse>(() => client.getAdminUserEntitlements(userId), onAuthorizationError, "Entitlement-status kunne ikke indlæses.", [client, userId]);
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (state.status === "loading") return <section className="detail-panel"><p>Indlæser entitlement-status...</p></section>;
  if (state.status === "error") return <section className="detail-panel"><p>{state.message}</p></section>;
  const { entitlements, overLimit } = state.data.entitlement;
  const plan = selectedPlan ?? entitlements.configuredPlan;
  async function savePlan() {
    setSaving(true);
    setMessage(null);
    try {
      await client.updateAdminUserEntitlement(userId, { plan });
      setMessage(`Brugerens abonnement er sat til ${plan === "free" ? "Free" : "Paid / Pro"}.`);
      retry();
    } catch (error) {
      if (!(await onAuthorizationError(error))) {
        setMessage(errorMessage(error, "Abonnementet kunne ikke gemmes."));
      }
    } finally {
      setSaving(false);
    }
  }

  return <><DetailGrid title="Entitlement-status" subtitle="Backend-evalueret adgang og forbrug" rows={[
    ["Plan", `${entitlements.plan} (konfigureret: ${entitlements.configuredPlan})`],
    ["Status", entitlements.status],
    ["Boliger", `${entitlements.usage.houses.active}/${entitlements.usage.houses.limit ?? "∞"}`],
    ["Dokumenter", `${entitlements.usage.documents.active}/${entitlements.usage.documents.limit ?? "∞"}`],
    ["Dokumentlager", `${Math.round(entitlements.usage.documents.storageBytes / 1024 / 1024 * 10) / 10}/${entitlements.usage.documents.storageLimitBytes === null ? "∞" : Math.round(entitlements.usage.documents.storageLimitBytes / 1024 / 1024)} MB`],
    ["Egne aktive opgaver", `${entitlements.usage.tasks.active}/${entitlements.usage.tasks.limit ?? "∞"}`],
    ["Over limit efter downgrade", overLimit.length ? overLimit.join(", ") : "Nej"]
  ]} /><section className="detail-panel subscription-panel"><header><h3>Abonnement</h3><span>Administrér brugerens adgangsplan</span></header><div className="subscription-controls"><label>Plan<select value={plan} onChange={(event) => setSelectedPlan(event.target.value as "free" | "pro")}><option value="free">Free</option><option value="pro">Paid / Pro</option></select></label><button className="primary-action" disabled={saving || plan === entitlements.configuredPlan} onClick={() => void savePlan()} type="button">{saving ? "Gemmer..." : "Gem abonnement"}</button></div>{message ? <p className="state-message">{message}</p> : null}</section></>;
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

function SortSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <FilterSelect label="Sortering" value={value} onChange={onChange} options={options} />;
}

function OrderButton({ order, setOrder }: { order: "asc" | "desc"; setOrder: (order: "asc" | "desc") => void }) {
  return <button className="secondary-action" type="button" onClick={() => setOrder(order === "asc" ? "desc" : "asc")}>{order === "asc" ? "Stigende" : "Faldende"}</button>;
}

function SortableHeader({ label, sortKey, currentSort, order, onSort, onOrder, onPageReset }: { label: string; sortKey: AdminUserSort; currentSort: AdminUserSort; order: "asc" | "desc"; onSort: (sort: AdminUserSort) => void; onOrder: (order: "asc" | "desc") => void; onPageReset: () => void }) {
  const active = currentSort === sortKey;
  function handleSort() {
    if (active) {
      onOrder(order === "asc" ? "desc" : "asc");
    } else {
      onSort(sortKey);
      onOrder("asc");
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
