import type { Entitlements } from "@matriva/shared";

export function subscriptionPresentation(entitlements: Entitlements, now = Date.now()) {
  const elapsed = Boolean(entitlements.expiresAt && Date.parse(entitlements.expiresAt) <= now);
  const pro = entitlements.accessPlan === "pro" && !elapsed;
  const complimentary = entitlements.source === "complimentary";
  const store = entitlements.source === "billing" || entitlements.source === "subscription";
  const issue = entitlements.status === "billing_issue" || entitlements.status === "grace_period";
  const cancelled = Boolean(store && entitlements.subscription?.autoRenew === false && pro);
  return {
    pro, complimentary, store, issue, cancelled,
    badge: pro ? complimentary ? "GRATIS PRO" : "PRO AKTIV" : "MATRIVA FREE",
    title: pro ? "Dit hjem. Fuldt overblik." : "Mere plads til dit hjem.",
    description: pro
      ? complimentary ? "Du har fået PRO-adgang af Matriva. Nyd fordelene uden betaling."
        : "Du har PRO. Dine udvidede muligheder er klar til brug."
      : "Saml flere boliger, dokumenter og opgaver med Matriva PRO.",
    notice: issue ? "Der er et problem med betalingen. Se status og dine muligheder i App Store."
      : elapsed || entitlements.status === "expired" ? "Din tidligere PRO-periode er udløbet. Dine data er stadig gemt."
      : entitlements.status === "refunded_revoked" ? "Dit tidligere køb giver ikke længere PRO-adgang. Dine data er stadig gemt."
      : entitlements.status === "cancelled" ? "Dit abonnement er afsluttet. Dine data er stadig gemt." : null
  };
}
