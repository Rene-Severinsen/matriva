import { useEffect, useMemo, useState } from "react";
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

type GuideSortKey =
  | "title"
  | "version"
  | "group"
  | "status"
  | "locale"
  | "sectionCount"
  | "activeAssetCount"
  | "validationStatus"
  | "openCount"
  | "updatedAt";

type SortOrder = "asc" | "desc";

const guideStatusLabels: Record<string, string> = {
  draft: "Kladde",
  published: "Udgivet",
  archived: "Arkiveret"
};

const guideValidationLabels: Record<string, string> = {
  approved: "Godkendt",
  in_review: "Under gennemgang",
  changes_requested: "Ændringer ønskes",
  not_requested: "Ikke gennemgået"
};

function sortValue(guide: AdminGuidesResponse["guides"][number], key: GuideSortKey) {
  switch (key) {
    case "version":
    case "sectionCount":
    case "activeAssetCount":
    case "openCount":
      return guide[key];
    case "group":
      return guide.group ?? "";
    case "status":
      return guideStatusLabels[guide.status] ?? guide.status;
    case "validationStatus":
      return guideValidationLabels[guide.validationStatus] ?? guide.validationStatus;
    case "updatedAt":
      return new Date(guide.updatedAt).getTime();
    default:
      return guide[key];
  }
}

function SortableGuideHeader({ label, sortKey, currentSort, order, onSort }: { label: string; sortKey: GuideSortKey; currentSort: GuideSortKey; order: SortOrder; onSort: (sortKey: GuideSortKey) => void }) {
  const active = currentSort === sortKey;
  return <th aria-sort={active ? order === "asc" ? "ascending" : "descending" : "none"}><button className={`table-sort-button${active ? " active" : ""}`} onClick={() => onSort(sortKey)} type="button"><span>{label}</span><span className="table-sort-indicator" aria-hidden="true">{active ? order === "asc" ? "↑" : "↓" : "↕"}</span></button></th>;
}

function GuideOpenHeatmap({ data }: { data: AdminGuidesResponse["openHeatmap"] }) {
  const maximum = Math.max(1, ...data.map((entry) => entry.count));
  const total = data.reduce((sum, entry) => sum + entry.count, 0);
  return <section className="guide-open-heatmap" aria-label="Vejledningsåbninger de seneste 12 uger">
    <div className="guide-open-heatmap-heading"><div><p className="eyebrow">Brug</p><h3>Åbninger de seneste 12 uger</h3></div><strong>{total} åbninger</strong></div>
    <div className="guide-open-heatmap-grid" role="img" aria-label={`${total} vejledningsåbninger fordelt på de seneste 12 uger`}>
      {data.map((entry) => <span className={`guide-open-heatmap-cell guide-open-heatmap-level-${entry.count === 0 ? 0 : Math.min(4, Math.ceil((entry.count / maximum) * 4))}`} key={entry.date} title={`${new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(`${entry.date}T12:00:00`))}: ${entry.count} åbninger`} />)}
    </div>
    <div className="guide-open-heatmap-caption"><span>Ingen åbninger</span><span className="guide-open-heatmap-legend"><i className="guide-open-heatmap-cell guide-open-heatmap-level-0" /><i className="guide-open-heatmap-cell guide-open-heatmap-level-2" /><i className="guide-open-heatmap-cell guide-open-heatmap-level-4" /></span><span>Flest åbninger</span></div>
  </section>;
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
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<GuideSortKey>("title");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
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

  const visibleGuides = useMemo(() => {
    if (!list) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("da-DK");
    const filtered = list.guides.filter((guide) => {
      if (group !== "all" && guide.group !== group) return false;
      if (!normalizedQuery) return true;
      const searchableText = [guide.title, guide.key, guide.group ?? "", guideStatusLabels[guide.status] ?? guide.status, guide.locale, guideValidationLabels[guide.validationStatus] ?? guide.validationStatus].join(" ").toLocaleLowerCase("da-DK");
      return searchableText.includes(normalizedQuery);
    });
    return [...filtered].sort((left, right) => {
      const leftValue = sortValue(left, sortKey);
      const rightValue = sortValue(right, sortKey);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), "da-DK", { numeric: true, sensitivity: "base" });
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [group, list, query, sortKey, sortOrder]);

  function changeSort(nextSortKey: GuideSortKey) {
    if (sortKey === nextSortKey) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextSortKey);
    setSortOrder("asc");
  }

  if (detail && selected) return <div className="admin-data-page"><button className="secondary-action" onClick={() => { setSelected(null); onNavigate(); }} type="button">Tilbage</button><section className="detail-panel guide-detail-panel"><header><div><p className="eyebrow">Vejledning</p><h2>{selected.guide.version.title}</h2><span>{selected.guide.key}</span></div><span className={`status-badge status-${selected.guide.version.publicationStatus}`}>{statusLabel(selected.guide.version.publicationStatus)}</span></header><div className="guide-status-control"><label>Status<select disabled={saving} value={selected.guide.version.publicationStatus === "published" ? "published" : "draft"} onChange={(event) => void updateStatus(event.target.value as "draft" | "published")}><option value="draft">Kladde</option><option value="published">Udgivet</option></select></label><p>Publicering kræver valideringsstatus <strong>godkendt</strong>.</p></div><GuideContent client={client} guide={selected.guide} /></section><section className="detail-panel"><header><h3>Statushistorik</h3><span>Nyeste først</span></header>{selected.audit.length === 0 ? <p>Ingen statusændringer er registreret endnu.</p> : <div className="audit-list">{selected.audit.map((entry) => <div className="audit-row" key={entry.id}><strong>{formatDate(entry.createdAt)}</strong><span>{auditActionLabel(entry.action)}</span><span>{statusLabel(entry.fromStatus)} → {statusLabel(entry.toStatus)}</span><span>{entry.actorLabel ?? "Ukendt aktør"}</span></div>)}</div>}</section>{error ? <p className="state-message error">{error}</p> : null}</div>;

  return <div className="admin-data-page"><section className="data-heading"><div><h2>Vejledninger</h2><p>Læs og styr runtime-status for eksisterende vejledningsversioner.</p></div></section>{list ? <GuideOpenHeatmap data={list.openHeatmap} /> : null}<section className="data-toolbar guides-toolbar"><label>Søg<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg i titel eller nøgle..." /></label><label>Gruppering<select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">Alle</option>{list?.groups.map((groupOption) => <option key={groupOption} value={groupOption}>{groupOption}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Alle</option><option value="draft">Kladder</option><option value="published">Udgivet</option></select></label></section>{error ? <p className="state-message error">{error}</p> : null}{!list ? <section className="data-state">Indlæser...</section> : <><p className="result-count">{visibleGuides.length} af {list.guides.length} vejledninger</p><div className="table-scroll"><table className="data-table guides-table"><thead><tr><SortableGuideHeader label="Titel" sortKey="title" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Version" sortKey="version" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Gruppering" sortKey="group" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Status" sortKey="status" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Sprog" sortKey="locale" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Afsnit" sortKey="sectionCount" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Billeder" sortKey="activeAssetCount" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Validering" sortKey="validationStatus" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Åbninger" sortKey="openCount" currentSort={sortKey} order={sortOrder} onSort={changeSort} /><SortableGuideHeader label="Senest ændret" sortKey="updatedAt" currentSort={sortKey} order={sortOrder} onSort={changeSort} /></tr></thead><tbody>{visibleGuides.map((guide) => <tr key={`${guide.id}:${guide.version}`} onClick={() => onNavigate(guide.id)}><td><strong>{guide.title}</strong><span>{guide.key}</span></td><td>v{guide.version}</td><td>{guide.group ?? "Ikke angivet"}</td><td><span className={`status-badge status-${guide.status}`}>{statusLabel(guide.status)}</span></td><td>{guide.locale}</td><td>{guide.sectionCount}</td><td>{guide.activeAssetCount}</td><td>{guideValidationLabels[guide.validationStatus] ?? "Ikke gennemgået"}</td><td>{guide.openCount}</td><td>{formatDate(guide.updatedAt)}</td></tr>)}</tbody></table></div></>}</div>;
}
