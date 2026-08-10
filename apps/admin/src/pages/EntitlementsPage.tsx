import { useEffect, useState } from "react";
import type { MatrivaAdminApiClient } from "@matriva/api-client";
import type { AdminEntitlementConfigResponse, FeatureKey, EntitlementValue } from "@matriva/shared";

const featureLabels: Record<FeatureKey, string> = {
  "houses.maxActive": "Aktive boliger",
  "documents.maxCount": "Aktive dokumenter",
  "documents.maxStorageMb": "Dokumentlager (MB)",
  "tasks.maxActive": "Aktive egne opgaver",
  "maintenance.fullPlan.enabled": "Fuld vedligeholdelsesplan",
  "seasonalRecommendations.enabled": "Sæsonanbefalinger",
  "advisories.enabled": "Boligejer-advarsler",
  "localAdvisories.enabled": "Lokale advarsler",
  "legalUpdates.enabled": "Lov- og regelopdateringer",
  "documentExpiry.enabled": "Dokumentudløb og garantier",
  "sharing.enabled": "Deling",
  "multiUser.enabled": "Flere brugere",
  "export.enabled": "Eksport",
  "history.extended.enabled": "Udvidet historik",
  "advancedReminders.enabled": "Avancerede reminders"
};

const featureKeys = Object.keys(featureLabels) as FeatureKey[];

const limitFeatureKeys: FeatureKey[] = [
  "houses.maxActive",
  "documents.maxCount",
  "documents.maxStorageMb",
  "tasks.maxActive"
];

const featureGroups: Array<{ title: string; keys: FeatureKey[] }> = [
  {
    title: "Vedligeholdelse",
    keys: ["maintenance.fullPlan.enabled", "seasonalRecommendations.enabled", "advancedReminders.enabled"]
  },
  {
    title: "Advarsler og opdateringer",
    keys: ["advisories.enabled", "localAdvisories.enabled", "legalUpdates.enabled"]
  },
  {
    title: "Dokumenter og historik",
    keys: ["documentExpiry.enabled", "history.extended.enabled", "export.enabled"]
  },
  {
    title: "Deling",
    keys: ["sharing.enabled", "multiUser.enabled"]
  }
];

const featureDescriptions: Partial<Record<FeatureKey, string>> = {
  "houses.maxActive": "Hvor mange aktive boliger brugeren kan have",
  "documents.maxCount": "Antal dokumenter på tværs af brugerens boliger",
  "documents.maxStorageMb": "Samlet lagerplads til dokumenter",
  "tasks.maxActive": "Antal aktive opgaver oprettet af brugeren"
};

export function EntitlementsPage({ client, onAuthorizationError }: { client: MatrivaAdminApiClient; onAuthorizationError: (error: unknown) => Promise<boolean> }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; data?: AdminEntitlementConfigResponse; message?: string }>({ status: "loading" });
  const [drafts, setDrafts] = useState<Record<"free" | "pro", Record<FeatureKey, EntitlementValue>> | null>(null);
  const [saving, setSaving] = useState<"free" | "pro" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void client.getAdminEntitlementConfig().then((data) => {
      setState({ status: "ready", data });
      setDrafts({ free: data.plans.find((plan) => plan.plan === "free")!.features, pro: data.plans.find((plan) => plan.plan === "pro")!.features });
    }).catch(async (error) => {
      if (await onAuthorizationError(error)) return;
      setState({ status: "error", message: error instanceof Error ? error.message : "Konfigurationen kunne ikke indlæses." });
    });
  }, [client, onAuthorizationError]);

  function setValue(plan: "free" | "pro", key: FeatureKey, value: EntitlementValue) {
    setDrafts((current) => current ? { ...current, [plan]: { ...current[plan], [key]: value } } : current);
  }

  async function save(plan: "free" | "pro") {
    const features = drafts?.[plan];
    if (!features) return;
    setSaving(plan); setMessage(null);
    try {
      const updated = await client.updateAdminEntitlementConfig(plan, { features });
      setDrafts((current) => current ? { ...current, [plan]: updated.features } : current);
      setMessage(`${plan === "free" ? "Free" : "Pro"}-konfigurationen er gemt og logget i audit trail.`);
    } catch (error) {
      if (!(await onAuthorizationError(error))) setMessage(error instanceof Error ? error.message : "Konfigurationen kunne ikke gemmes.");
    } finally { setSaving(null); }
  }

  if (state.status === "loading") return <div className="full-page-state"><h2>Indlæser entitlements</h2><p>Henter backend-konfigurationen.</p></div>;
  if (state.status === "error") return <div className="full-page-state"><h2>Kunne ikke indlæse entitlements</h2><p>{state.message}</p></div>;
  if (!drafts) return null;

  return <div className="dashboard-page entitlements-page">
    <section className="dashboard-heading entitlements-heading">
      <div>
        <p className="eyebrow">Adgangsstyring</p>
        <h2>Planer og adgang</h2>
        <p>Konfigurér hvad Free- og Pro-brugere kan bruge i Matriva.</p>
      </div>
      <div className="entitlement-header-meta"><span className="status-badge">2 planer</span><span>Ændringer gemmes i audit trail</span></div>
    </section>
    {message ? <p className="state-message">{message}</p> : null}
    <section className="entitlement-intro">
      <div><strong>Sådan bruges siden</strong><p>Grænser styrer forbrug. Funktioner styrer hvilke dele af appen planen har adgang til. Brugeren får altid sin aktuelle adgang fra backend.</p></div>
      <span>Gem Free og Pro separat</span>
    </section>
    <div className="entitlement-plan-grid">
      {(["free", "pro"] as const).map((plan) => <section className={`entitlement-plan-card entitlement-plan-${plan}`} key={plan}>
        <header className="entitlement-plan-header">
          <div><div className="entitlement-plan-title"><h3>{plan === "free" ? "Free" : "Pro"}</h3><span className="plan-badge">{plan === "free" ? "Standard" : "Udvidet adgang"}</span></div><p>{plan === "free" ? "En enkel start med tydelige standardgrænser." : "Flere funktioner og plads til boligejere med større behov."}</p></div>
          <button className="primary-action" disabled={saving === plan} onClick={() => void save(plan)} type="button">{saving === plan ? "Gemmer..." : `Gem ${plan === "free" ? "Free" : "Pro"}`}</button>
        </header>
        <div className="entitlement-section">
          <div className="entitlement-section-heading"><div><h4>Forbrugsgrænser</h4><p>Hvor meget brugeren kan have eller oprette.</p></div><span className="section-count">4 grænser</span></div>
          <div className="entitlement-limit-list">
            {limitFeatureKeys.map((key) => {
              const value = drafts[plan][key];
              if (value.kind !== "limit") return null;
              return <label className="entitlement-limit-row" key={key}><span><strong>{featureLabels[key]}</strong><small>{featureDescriptions[key]}</small></span><span className="entitlement-limit-input"><input aria-label={featureLabels[key]} min="0" onChange={(event) => setValue(plan, key, { kind: "limit", value: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={value.value ?? ""} /><small>{value.value === null ? "Ingen grænse" : "pr. bruger"}</small></span></label>;
            })}
          </div>
        </div>
        <div className="entitlement-section">
          <div className="entitlement-section-heading"><div><h4>Funktioner</h4><p>Slå funktioner til eller fra for denne plan.</p></div><span className="section-count">{featureKeys.length - limitFeatureKeys.length} funktioner</span></div>
          <div className="entitlement-feature-groups">
            {featureGroups.map((group) => <div className="entitlement-feature-group" key={group.title}><h5>{group.title}</h5><div className="entitlement-feature-list">{group.keys.map((key) => { const value = drafts[plan][key]; if (value.kind !== "boolean") return null; return <label className="entitlement-feature-row" key={key}><span>{featureLabels[key]}</span><input aria-label={featureLabels[key]} checked={value.value} onChange={(event) => setValue(plan, key, { kind: "boolean", value: event.target.checked })} type="checkbox" /></label>; })}</div></div>)}
          </div>
        </div>
        <footer className="entitlement-plan-footer"><span>Sidst hentet fra backend-konfigurationen</span><button className="secondary-action" disabled={saving === plan} onClick={() => void save(plan)} type="button">{saving === plan ? "Gemmer..." : "Gem ændringer"}</button></footer>
      </section>)}
    </div>
  </div>;
}
