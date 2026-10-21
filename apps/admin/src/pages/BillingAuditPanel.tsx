import { useEffect, useState } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type { AdminBillingAudit, AdminBillingEventDetail, Entitlements } from "@matriva/shared";

type Event = AdminBillingAudit["events"][number];
const date = (value: string | null) => value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Copenhagen" }).format(new Date(value)) : "Ikke registreret";
const environment = (value: string) => value === "sandbox" ? "Sandbox · testkøb uden reel betaling" : "Produktion · butikskøb";
const statuses: Record<string, string> = { active: "Aktiv", expired: "Udløbet", cancelled: "Opsagt", refunded_revoked: "Refunderet eller tilbagekaldt", trial: "Prøveperiode", grace_period: "Betalingsfrist", billing_issue: "Betalingsproblem" };
const processingResults: Record<string, string> = { processed: "Behandlet", ignored_older: "Ældre hændelse · adgang uændret", unmatched: "Bruger ikke fundet", failed: "Fejl", received: "Afventer", legacy_unknown: "Ældre hændelse · resultat ukendt" };
const eventNames: Record<string, string> = {
  PURCHASE_SYNC: "Køb eller gendannelse synkroniseret fra appen", SUBSCRIBED: "Abonnement startet",
  DID_RENEW: "Fornyelse gennemført", DID_FAIL_TO_RENEW: "Betaling kunne ikke fornyes",
  DID_CHANGE_RENEWAL_STATUS: "Automatisk fornyelse ændret", DID_CHANGE_RENEWAL_PREF: "Planvalg ændret",
  EXPIRED: "Abonnement udløbet", GRACE_PERIOD_EXPIRED: "Betalingsfrist udløbet",
  REFUND: "Køb refunderet", REFUND_DECLINED: "Refundering afvist", REFUND_REVERSED: "Refundering trukket tilbage",
  REVOKE: "Adgang tilbagekaldt", PRICE_INCREASE: "Prisændring", RENEWAL_EXTENDED: "Fornyelse forlænget"
};
const appleFields: Array<[string, string, "transaction" | "renewal" | "notification"]> = [
  ["Notification type", "notificationType", "notification"], ["Subtype", "subtype", "notification"],
  ["Notification UUID", "notificationUUID", "notification"], ["Apple signedDate", "signedDate", "notification"],
  ["Transaction ID", "transactionId", "transaction"], ["Original Transaction ID", "originalTransactionId", "transaction"],
  ["Web Order Line Item ID", "webOrderLineItemId", "transaction"], ["Product ID", "productId", "transaction"],
  ["Bundle ID", "bundleId", "transaction"], ["Subscription Group ID", "subscriptionGroupIdentifier", "transaction"],
  ["Environment", "environment", "transaction"], ["Transaction reason", "transactionReason", "transaction"],
  ["Purchase date", "purchaseDate", "transaction"], ["Original purchase date", "originalPurchaseDate", "transaction"],
  ["Aktuel periode starter", "purchaseDate", "transaction"], ["Transaktionens signedDate", "signedDate", "transaction"],
  ["Expiration date", "expiresDate", "transaction"], ["Revocation date", "revocationDate", "transaction"],
  ["Revocation reason", "revocationReason", "transaction"], ["Revocation type", "revocationType", "transaction"],
  ["Storefront", "storefront", "transaction"], ["Storefront ID", "storefrontId", "transaction"],
  ["Transaction currency", "currency", "transaction"], ["Transaction price", "price", "transaction"],
  ["App Account Token", "appAccountToken", "transaction"], ["App Transaction ID", "appTransactionId", "transaction"],
  ["Transaction offer ID", "offerIdentifier", "transaction"], ["Transaction offer type", "offerType", "transaction"],
  ["Auto-renew status", "autoRenewStatus", "renewal"], ["Auto-renew product", "autoRenewProductId", "renewal"],
  ["Renewal date", "renewalDate", "renewal"], ["Renewal price", "renewalPrice", "renewal"],
  ["Currency", "currency", "renewal"], ["Grace period expires", "gracePeriodExpiresDate", "renewal"],
  ["Billing retry", "isInBillingRetryPeriod", "renewal"], ["Expiration intent", "expirationIntent", "renewal"],
  ["Price increase status", "priceIncreaseStatus", "renewal"], ["Offer type", "offerType", "renewal"],
  ["Offer ID", "offerIdentifier", "renewal"], ["Recent subscription start", "recentSubscriptionStartDate", "renewal"]
];

function displayAppleValue(value: unknown, key: string) {
  if (value === null || value === undefined) return "Ikke leveret af Apple";
  if (typeof value === "boolean") return value ? "Ja" : "Nej";
  if (typeof value === "number" && /Date$|signedDate/.test(key)) return date(new Date(value).toISOString());
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function accessReason(entitlements: Entitlements, subscription: AdminBillingAudit["subscriptions"][number] | undefined, latest: Event | undefined) {
  if (entitlements.accessPlan === "pro") {
    if (entitlements.source === "complimentary") return "Gratis PRO-adgang givet administrativt.";
    if (entitlements.status === "grace_period") return "PRO aktiv i Apples betalingsfrist.";
    return entitlements.source === "billing" ? "PRO aktiv via App Store." : "PRO aktiv via eksisterende abonnement.";
  }
  if (subscription?.status === "refunded_revoked") return "Købet blev refunderet eller adgangen tilbagekaldt.";
  if (subscription?.status === "billing_issue") return "PRO ikke aktiv — betalingen kunne ikke fornyes.";
  if (subscription?.status === "expired" && latest?.subtype === "VOLUNTARY") return "Abonnementet udløb efter frivillig opsigelse.";
  if (subscription?.status === "expired") return "Apple-abonnementet er udløbet.";
  if (latest?.eventType === "EXPIRED" && latest.subtype === "VOLUNTARY") return "Abonnementet udløb efter frivillig opsigelse.";
  if (latest?.eventType === "DID_FAIL_TO_RENEW") return "Fornyelsen blev ikke gennemført.";
  if (latest?.eventType === "REFUND" || latest?.eventType === "REVOKE") return "Købet blev refunderet eller adgangen tilbagekaldt.";
  return entitlements.source === "billing" ? "Apple-abonnementet giver aktuelt ikke PRO-adgang." : "Free-adgang.";
}

export function BillingAuditPanel({ billing, entitlements, client, userId }: {
  billing: AdminBillingAudit | undefined; entitlements: Entitlements; client: MatrivaAdminApiClient; userId: string;
}) {
  const [events, setEvents] = useState<Event[]>(billing?.events ?? []);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(billing?.nextBeforeId ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AdminBillingEventDetail | null>(null);
  const [tab, setTab] = useState<"interpreted" | "raw" | "trace">("interpreted");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "apple" | "errors">("all");
  useEffect(() => { setEvents(billing?.events ?? []); setNextBeforeId(billing?.nextBeforeId ?? null); setSelected(null); }, [billing, userId]);
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected]);
  if (!billing) return <section className="detail-panel"><h3>Abonnementsforløb og Apple-hændelser</h3><p>Backend har ikke leveret købsoplysninger.</p></section>;
  const subscription = billing.subscriptions[0];
  const latestApple = events.find(event => event.eventType !== "PURCHASE_SYNC");
  const latest = events[0];
  const visible = events.filter(event => filter === "all" || filter === "apple" && event.eventType !== "PURCHASE_SYNC" || filter === "errors" && ["failed", "unmatched"].includes(event.processingStatus));

  async function showDetail(event: Event) {
    setBusy(true); setMessage(null);
    try { setSelected(await client.getAdminBillingEventDetail(userId, event.id)); setTab("interpreted"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Apple-data kunne ikke indlæses."); }
    finally { setBusy(false); }
  }
  async function loadMore() {
    if (!nextBeforeId) return;
    setLoadingMore(true); setMessage(null);
    try {
      const page = await client.getAdminBillingEvents(userId, nextBeforeId);
      setEvents(current => [...current, ...page.events]); setNextBeforeId(page.nextBeforeId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Flere hændelser kunne ikke indlæses."); }
    finally { setLoadingMore(false); }
  }
  async function copyText(value: string, action: "copy_raw" | "copy_decoded") {
    if (!selected) return;
    try {
      await client.auditAdminBillingPayloadAction(userId, selected.id, action);
      await navigator.clipboard.writeText(value);
      setMessage("Kopieret til udklipsholder.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kunne ikke kopiere."); }
  }
  async function download() {
    if (!selected) return;
    try {
      await client.auditAdminBillingPayloadAction(userId, selected.id, "download");
      const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `matriva-apple-event-${selected.id}.json`; link.click();
      URL.revokeObjectURL(url);
      setMessage("Hændelsen er downloadet.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kunne ikke downloade."); }
  }
  const interpreted = selected ? { transaction: selected.transaction, renewal: selected.renewal,
    notification: selected.notification ? Object.fromEntries(Object.entries(selected.notification).filter(([key]) => key !== "data")) : null } : null;
  return <section className="detail-panel billing-audit-panel">
    <header><div><h3>Abonnementsforløb og Apple-hændelser</h3><span>Backendens registrerede status og hændelser · dansk tidszone</span></div></header>
    <div className="billing-summary"><strong>{entitlements.accessPlan === "pro" ? "PRO aktiv" : "Free-adgang"}</strong>
      <span className="billing-badge">{entitlements.source === "complimentary" ? "Gratis PRO" : entitlements.source === "billing" ? "Apple App Store" : "Free"}</span>
      {subscription ? <span className="billing-badge">{environment(subscription.environment)}</span> : null}
      <p>{accessReason(entitlements, subscription, latest)}</p></div>
    {subscription ? <dl>
      {([
        ["Produkt", subscription.productId], ["Plan og status", `PRO · ${statuses[subscription.status] ?? subscription.status}`],
        ["Aktuel periode", `${date(subscription.periodStartsAt)} – ${date(subscription.periodEndsAt)}`],
        ["Automatisk fornyelse", subscription.autoRenew === null ? "Ikke leveret af Apple" : subscription.autoRenew ? "Aktiveret" : "Deaktiveret"],
        ["Næste fornyelse", date(subscription.renewalDate)], ["Senest verificeret", date(subscription.lastVerifiedAt)],
        ["Seneste Apple-hændelse", latestApple ? `${eventNames[latestApple.eventType] ?? latestApple.eventType} · ${date(latestApple.appleSignedAt)}` : "Ikke registreret"],
        ["Seneste behandling", latest ? `${processingResults[latest.processingStatus] ?? latest.processingStatus} · ${date(latest.processedAt)}` : "Ikke registreret"],
        ["Apple transaktion", subscription.transactionId ?? "Ikke registreret"],
        ["Oprindeligt transaktions-ID", subscription.originalTransactionId ?? "Ikke registreret"],
        ["Internt abonnement-ID", subscription.id]
      ] as Array<[string, string]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl> : <p>Ingen butikstransaktion registreret. En manuel gratis PRO-tildeling er ikke et Apple-køb.</p>}
    <div className="billing-timeline-heading"><div><h4>Hændelseslog</h4><p>Nyeste hændelser først. Appens købssynkronisering og Apples servernotifikationer er markeret særskilt.</p></div>
      <label>Vis<select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">Alle hændelser</option><option value="apple">Apple-notifikationer</option><option value="errors">Fejl og umatchede</option></select></label></div>
    {visible.length ? <ol className="billing-timeline">{visible.map(event => <li key={event.id}>
      <div className="billing-timeline-title"><strong>{eventNames[event.eventType] ?? event.eventType}{event.subtype ? ` · ${event.subtype}` : ""}</strong>
        <span className={`billing-result billing-result-${event.processingStatus}`}>{processingResults[event.processingStatus] ?? event.processingStatus}</span></div>
      <p>{event.eventType === "PURCHASE_SYNC" ? "Appens købssynkronisering" : "Apple Server Notification"} · {environment(event.environment)} · {event.eventType}</p>
      <div className="billing-timeline-meta"><span>Apple: {date(event.appleSignedAt)}</span><span>Modtaget: {date(event.receivedAt)}</span><span>Behandlet: {date(event.processedAt)}</span></div>
      <div className="billing-timeline-meta"><span>Transaktion: {event.transactionId ?? "Ikke registreret"}</span><span>Oprindelig: {event.originalTransactionId ?? "Ikke registreret"}</span><span>Log-ID: {event.id}</span><span>Apple event-ID: {event.eventId}</span><span>Internt abonnement-ID: {event.subscriptionId ?? "Ikke registreret"}</span></div>
      {event.processingError ? <p className="billing-error">Behandlingsfejl: {event.processingError}</p> : null}
      <button type="button" className="secondary-action" disabled={busy} onClick={() => void showDetail(event)}>Vis Apple-data</button>
    </li>)}</ol> : <p>Ingen hændelser for det valgte filter.</p>}
    {nextBeforeId ? <button type="button" className="secondary-action" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Indlæser..." : "Indlæs ældre hændelser"}</button> : null}
    {message ? <p role="status" className="state-message">{message}</p> : null}
    {selected ? <div className="billing-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><div className="billing-modal" role="dialog" aria-modal="true" aria-label="Apple-hændelsesdata">
      <header><div><h3>Apple-data · hændelse {selected.id}</h3><span>{selected.eventType}{selected.subtype ? ` / ${selected.subtype}` : ""} · {environment(selected.environment)}</span></div><button type="button" onClick={() => setSelected(null)} aria-label="Luk Apple-data">Luk</button></header>
      <nav aria-label="Apple-data faner"><button type="button" aria-selected={tab === "interpreted"} onClick={() => setTab("interpreted")}>Fortolket data</button><button type="button" aria-selected={tab === "raw"} onClick={() => setTab("raw")}>Rå JWS</button><button type="button" aria-selected={tab === "trace"} onClick={() => setTab("trace")}>Behandlingsspor</button></nav>
      {tab === "interpreted" ? <><dl>{appleFields.map(([label, key, source]) => <div key={`${source}-${key}`}><dt>{label}</dt><dd>{displayAppleValue(selected[source]?.[key], key)}</dd></div>)}</dl><button type="button" className="secondary-action" onClick={() => void copyText(JSON.stringify(interpreted, null, 2), "copy_decoded")}>Kopiér fortolket JSON</button></> : null}
      {tab === "raw" ? <div className="billing-raw"><p>Originale signerede værdier. Ældre hændelser kan mangle JWS, fordi de ikke blev gemt ved modtagelsen.</p>{([
        ["signedPayload", selected.signedPayload], ["signedTransactionInfo", selected.signedTransactionInfo], ["signedRenewalInfo", selected.signedRenewalInfo]
      ] as Array<[string, string | null]>).map(([label, value]) => <div key={label}><strong>{label}</strong><span> · {value ? `${new Blob([value]).size} bytes · ${selected.verification[label] ? "Signatur verificeret" : "Ingen verificering registreret"}` : "Ikke leveret eller ikke gemt"}</span>{value ? <><textarea readOnly value={value} aria-label={label} /><button type="button" className="secondary-action" onClick={() => void copyText(value, "copy_raw")}>Kopiér {label}</button></> : null}</div>)}</div> : null}
      {tab === "trace" ? <div className="billing-trace"><p>Correlation ID: {selected.correlationId ?? "Ikke registreret"} · Forsøg: {selected.processingAttemptCount} · Modtaget: {date(selected.receivedAt)}</p>{selected.processingSteps.length ? <ol>{selected.processingSteps.map((entry, index) => <li key={index}><strong>{String(entry.name ?? "Trin")}</strong> · {String(entry.result ?? "Ukendt")} · {date(typeof entry.at === "string" ? entry.at : null)}{entry.detail ? ` · ${String(entry.detail)}` : ""}</li>)}</ol> : <p>Behandlingsspor blev ikke gemt for denne ældre hændelse.</p>}{selected.processingError ? <p className="billing-error">Fejl: {selected.processingError}</p> : null}</div> : null}
      <footer><button type="button" className="secondary-action" onClick={() => void download()}>Download hændelse som JSON</button><button type="button" onClick={() => setSelected(null)}>Luk</button></footer>
    </div></div> : null}
  </section>;
}
