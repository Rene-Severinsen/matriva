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

  return <div className="dashboard-page">
    <section className="dashboard-heading"><div><h2>Planer og adgang</h2><p>Backend-styrede limits og feature flags. Ændringer påvirker nye API-handlinger.</p></div></section>
    {message ? <p className="state-message">{message}</p> : null}
    <div className="chart-grid">
      {(["free", "pro"] as const).map((plan) => <section className="data-panel" key={plan}>
        <div className="data-panel-header"><div><h3>{plan === "free" ? "Free" : "Pro"}</h3><p>{plan === "free" ? "Sikre standardgrænser" : "Konfigurerbar adgang uden fastlåste Pro-grænser"}</p></div><button className="primary-action" disabled={saving === plan} onClick={() => void save(plan)} type="button">{saving === plan ? "Gemmer..." : "Gem"}</button></div>
        <div className="entitlement-form-grid">
          {featureKeys.map((key) => {
            const value = drafts[plan][key];
            return <label key={key}><span>{featureLabels[key]}</span>{value.kind === "limit" ? <input min="0" onChange={(event) => setValue(plan, key, { kind: "limit", value: event.target.value === "" ? null : Number(event.target.value) })} type="number" value={value.value ?? ""} /> : <input checked={value.value} onChange={(event) => setValue(plan, key, { kind: "boolean", value: event.target.checked })} type="checkbox" />}</label>;
          })}
        </div>
      </section>)}
    </div>
  </div>;
}
