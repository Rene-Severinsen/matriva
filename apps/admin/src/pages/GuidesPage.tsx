import { useEffect, useState } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import { guideSectionLabel, guideSectionTitle, presentGuideSection, type AdminGuideResponse, type AdminGuidesResponse, type GuideResponse } from "@matriva/shared";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Ikke registreret";
}

function statusLabel(status: string) {
  return status === "published" ? "Udgivet" : status === "draft" ? "Kladde" : status === "archived" ? "Arkiveret" : "Ukendt";
}

function auditActionLabel(action: string) {
  if (action === "guide_published") return "Guiden blev udgivet";
  if (action === "guide_unpublished") return "Guiden blev taget af udgivelse";
  if (action === "guide_status_changed") return "Status ændret";
  return "Status ændret";
}

function GuideContent({ client, guide }: { client: MatrivaAdminApiClient; guide: GuideResponse }) {
  const [assetSources, setAssetSources] = useState<Record<string, string>>({});
  const [assetErrors, setAssetErrors] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    setAssetSources({});
    setAssetErrors({});
    for (const asset of guide.version.assets) {
      void client.getGuideAsset(asset.assetKey)
        .then((source) => {
          if (active) setAssetSources((current) => ({ ...current, [asset.id]: source }));
        })
        .catch(() => {
          if (active) setAssetErrors((current) => ({ ...current, [asset.id]: true }));
        });
    }
    return () => { active = false; };
  }, [client, guide.version.assets]);
  return <div className="guide-detail-content">
    <div className="guide-meta-grid">
      <div><span>Version</span><strong>v{guide.version.versionNumber}</strong></div>
      <div><span>Locale</span><strong>{guide.version.locale}</strong></div>
      <div><span>Validering</span><strong>{guide.version.validationStatus === "approved" ? "Godkendt" : guide.version.validationStatus === "in_review" ? "Under gennemgang" : guide.version.validationStatus === "changes_requested" ? "Ændringer ønskes" : "Ikke gennemgået"}</strong></div>
      <div><span>Sections</span><strong>{guide.version.sections.length}</strong></div>
      <div><span>Assets</span><strong>{guide.version.assets.length}</strong></div>
    </div>
    {guide.version.summary ? <p className="guide-summary">{guide.version.summary}</p> : null}
    {guide.version.assets.length > 0 ? <section className="guide-assets"><h3>Billeder</h3><div className="guide-asset-grid">{guide.version.assets.map((asset) => <figure key={asset.id}>{assetSources[asset.id] ? <img alt={asset.altText ?? asset.assetKey} src={assetSources[asset.id]} /> : <div className="guide-asset-placeholder">{assetErrors[asset.id] ? "Billedet kunne ikke indlæses." : "Indlæser billede..."}</div>}<figcaption><strong>{asset.placement}</strong> · {asset.caption ?? asset.altText ?? asset.assetKey}</figcaption></figure>)}</div></section> : null}
    <section className="guide-sections"><h3>Indhold</h3>{guide.version.sections.map((section) => { const blocks = presentGuideSection(section); if (blocks.length === 0) return null; return <article className="guide-section" key={section.id}><div className="guide-section-heading"><span>{guideSectionLabel(section.sectionType, section.sectionKey)}</span><h4>{guideSectionTitle({ ...section, title: section.title })}</h4></div><div className="guide-section-body">{blocks.map((block, index) => block.kind === "bullet" ? <p className="guide-bullet" key={index}>{block.text}</p> : block.kind === "label" ? <p key={index}><strong>{block.label}:</strong> {block.text}</p> : <p key={index}>{block.text}</p>)}</div></article>; })}</section>
  </div>;
}

export function GuidesPage({ client, onAuthorizationError, detail, onNavigate }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean>; detail: { view: "guides"; id: string } | null; onNavigate: (id?: string) => void }) {
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [list, setList] = useState<AdminGuidesResponse | null>(null);
  const [selected, setSelected] = useState<AdminGuideResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (detail) {
      void client.getAdminGuide(detail.id).then(setSelected).catch(async (caught) => { if (!(await onAuthorizationError(caught))) setError(caught instanceof Error ? caught.message : "Guiden kunne ikke indlæses."); });
      return;
    }
    void client.getAdminGuides({ status }).then(setList).catch(async (caught) => { if (!(await onAuthorizationError(caught))) setError(caught instanceof Error ? caught.message : "Guides kunne ikke indlæses."); });
  }, [client, detail, onAuthorizationError, status]);

  async function updateStatus(nextStatus: "draft" | "published") {
    if (!selected) return;
    setSaving(true); setError(null);
    try { setSelected(await client.updateAdminGuideStatus(selected.guide.id, { status: nextStatus })); }
    catch (caught) { if (!(await onAuthorizationError(caught))) setError(caught instanceof Error ? caught.message : "Status kunne ikke gemmes."); }
    finally { setSaving(false); }
  }

  if (detail && selected) return <div className="admin-data-page"><button className="secondary-action" onClick={() => { setSelected(null); onNavigate(); }} type="button">Tilbage</button><section className="detail-panel guide-detail-panel"><header><div><p className="eyebrow">Vejledning</p><h2>{selected.guide.version.title}</h2><span>{selected.guide.key}</span></div><span className={`status-badge status-${selected.guide.version.publicationStatus}`}>{statusLabel(selected.guide.version.publicationStatus)}</span></header><div className="guide-status-control"><label>Status<select disabled={saving} value={selected.guide.version.publicationStatus === "published" ? "published" : "draft"} onChange={(event) => void updateStatus(event.target.value as "draft" | "published")}><option value="draft">Kladde</option><option value="published">Udgivet</option></select></label><p>Publicering kræver valideringsstatus <strong>godkendt</strong>.</p></div><GuideContent client={client} guide={selected.guide} /></section><section className="detail-panel"><header><h3>Statushistorik</h3><span>Nyeste først</span></header>{selected.audit.length === 0 ? <p>Ingen statusændringer er registreret endnu.</p> : <div className="audit-list">{selected.audit.map((entry) => <div className="audit-row" key={entry.id}><strong>{formatDate(entry.createdAt)}</strong><span>{auditActionLabel(entry.action)}</span><span>{statusLabel(entry.fromStatus)} → {statusLabel(entry.toStatus)}</span><span>{entry.actorLabel ?? "Ukendt aktør"}</span></div>)}</div>}</section>{error ? <p className="state-message error">{error}</p> : null}</div>;

  return <div className="admin-data-page"><section className="data-heading"><div><h2>Vejledninger</h2><p>Læs og styr runtime-status for eksisterende vejledningsversioner.</p></div></section><section className="data-toolbar"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Alle</option><option value="draft">Kladder</option><option value="published">Udgivet</option></select></label></section>{error ? <p className="state-message error">{error}</p> : null}{!list ? <section className="data-state">Indlæser...</section> : <div className="table-scroll"><table className="data-table guides-table"><thead><tr><th>Titel</th><th>Version</th><th>Status</th><th>Sprog</th><th>Afsnit</th><th>Billeder</th><th>Validering</th><th>Senest ændret</th></tr></thead><tbody>{list.guides.map((guide) => <tr key={`${guide.id}:${guide.version}`} onClick={() => onNavigate(guide.id)}><td><strong>{guide.title}</strong></td><td>v{guide.version}</td><td><span className={`status-badge status-${guide.status}`}>{statusLabel(guide.status)}</span></td><td>{guide.locale}</td><td>{guide.sectionCount}</td><td>{guide.activeAssetCount}</td><td>{guide.validationStatus === "approved" ? "Godkendt" : guide.validationStatus === "in_review" ? "Under gennemgang" : guide.validationStatus === "changes_requested" ? "Ændringer ønskes" : "Ikke gennemgået"}</td><td>{formatDate(guide.updatedAt)}</td></tr>)}</tbody></table></div>}</div>;
}
