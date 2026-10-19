import type { AdminBillingAudit } from "@matriva/shared";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "long", timeZone: "Europe/Copenhagen" }).format(new Date(value)) : "Ikke registreret";
const provider = (value: string) => value === "apple" ? "Apple App Store" : "Google Play";
const environment = (value: string) => value === "sandbox" ? "Sandbox · testkøb, ingen reel betaling" : "Produktion · butikskøb";
const statuses: Record<string, string> = { active: "Aktiv ved seneste verifikation", expired: "Udløbet", cancelled: "Opsagt", refunded_revoked: "Refunderet / tilbagekaldt", trial: "Prøveperiode", grace_period: "Betalingsfrist", billing_issue: "Betalingsproblem" };

export function BillingAuditPanel({ billing }: { billing: AdminBillingAudit | undefined }) {
  if (!billing) return <section className="detail-panel"><h3>Butikskøb og hændelseslog</h3><p>Backend har ikke leveret købsoplysninger. Genindlæs efter QA-opdateringen.</p></section>;
  return <section className="detail-panel">
    <header><h3>Butikskøb og hændelseslog</h3><span>Registrerede transaktioner fra backend · tider i dansk tidszone</span></header>
    {!billing.subscriptions.length ? <p>Ingen butikstransaktioner registreret for denne bruger. PRO-adgang alene dokumenterer ikke et butikskøb.</p> : billing.subscriptions.map(s => <article key={s.id}>
      <h4>{provider(s.provider)} · {environment(s.environment)}</h4>
      <p>{s.lastVerifiedAt ? "Transaktionen er verificeret af backend." : "Verifikationstidspunkt er ikke registreret."} Status nedenfor viser den senest gemte kontrol.</p>
      <dl>
        {([
          ["Produkt", s.productId], ["Status", statuses[s.status] ?? s.status],
          ["Aktuel periode starter", date(s.periodStartsAt)], ["Aktuel periode slutter", date(s.periodEndsAt)],
          ["Perioden passeret", !s.periodEndsAt ? "Ukendt" : Date.parse(s.periodEndsAt) <= Date.now() ? "Ja · afvent ny verifikation" : "Nej"],
          ["Automatisk fornyelse", s.autoRenew === null ? "Ukendt · ikke registreret" : s.autoRenew ? "Ja" : "Nej"],
          ["Senest verificeret", date(s.lastVerifiedAt)], ["Transaktions-ID", s.transactionId ?? "Ikke registreret"],
          ["Oprindeligt transaktions-ID", s.originalTransactionId ?? "Ikke registreret"],
          ["Intern abonnements-ID", s.id], ["Registreret", date(s.createdAt)], ["Senest opdateret", date(s.updatedAt)]
        ] as Array<[string, string]>).map(([label, value]) => <div key={label}><dt>{label}</dt><dd style={{ overflowWrap: "anywhere" }}>{value}</dd></div>)}
      </dl>
    </article>)}
    <h4>Hændelseslog · seneste {billing.eventLimit}</h4>
    <p>PURCHASE_SYNC er synkronisering fra appen ved køb eller gendannelse. Andre hændelser er modtagne butiksnotifikationer. Manglende behandlingstidspunkt betyder, at behandlingsresultatet ikke er logget særskilt.</p>
    {!billing.events.length ? <p>Ingen tilknyttede hændelser registreret.</p> : <div className="table-scroll"><table className="data-table"><thead><tr>
      <th>Modtaget</th><th>Hændelse / butik / miljø</th><th>Identifikation</th><th>Behandling</th>
    </tr></thead><tbody>{billing.events.map(e => <tr key={e.id}>
      <td>{date(e.receivedAt)}<br />Hændelsestid: {date(e.occurredAt)}</td>
      <td>{e.eventType}<br />{provider(e.provider)}<br />{environment(e.environment)}</td>
      <td style={{ overflowWrap: "anywhere" }}>Log-ID: {e.id}<br />Event-ID: {e.eventId}<br />Transaktion: {e.transactionId ?? "Ikke registreret"}</td>
      <td>{e.processingError ? "Fejl: " + e.processingError : e.processedAt ? "Behandlet: " + date(e.processedAt) : "Behandlingsresultat ikke registreret"}</td>
    </tr>)}</tbody></table></div>}
  </section>;
}

