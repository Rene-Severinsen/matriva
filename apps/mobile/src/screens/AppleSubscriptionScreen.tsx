import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { getAvailablePurchases as getStorePurchases, showManageSubscriptionsIOS, useIAP, type Purchase } from "expo-iap";
import type { MatrivaApiClient } from "@matriva/api-client";
import type { Entitlements } from "@matriva/shared";
import { SubscriptionView } from "./SubscriptionView";
import { subscriptionPresentation } from "./subscriptionPresentation";

const monthlyProductId = process.env.EXPO_PUBLIC_MATRIVA_APPLE_PRO_PRODUCT_ID?.trim() || "matriva.pro.monthly";
const yearlyProductId = process.env.EXPO_PUBLIC_MATRIVA_APPLE_PRO_YEARLY_PRODUCT_ID?.trim() || "matriva.pro.yearly";
const productIds = [monthlyProductId, yearlyProductId];

export function AppleSubscriptionScreen({ apiClient, entitlements, onEntitlementsChanged, onBack }: {
  apiClient: MatrivaApiClient; entitlements: Entitlements; onEntitlementsChanged: (value: Entitlements) => void; onBack: () => void;
}) {
  const [current, setCurrent] = useState(entitlements);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const mounted = useRef(true);
  const revision = useRef(0);
  const onChanged = useRef(onEntitlementsChanged);
  onChanged.current = onEntitlementsChanged;
  const pending = useRef(new Map<string, Promise<Entitlements>>());
  const { connected, subscriptions, fetchProducts, requestPurchase, restorePurchases, finishTransaction, reconnect } = useIAP({
    onPurchaseSuccess: purchase => {
      if (!productIds.includes(purchase.productId)) return;
      setBusy(true);
      void sync(purchase).catch(() => {
        if (mounted.current) setMessage({ text: "Vi kunne ikke bekræfte købet lige nu. Hvis Apple har gennemført det, kan du trykke Gendan køb. Du skal ikke købe igen.", error: true });
      }).finally(() => { if (mounted.current) setBusy(false); });
    },
    onPurchaseError: () => {
      if (!mounted.current) return;
      setBusy(false);
      setMessage({ text: "Købet blev ikke gennemført. Du kan prøve igen, når du er klar.", error: true });
    }
  });

  function apply(value: Entitlements) {
    if (!mounted.current) return;
    revision.current += 1;
    setCurrent(value); setVerified(true); setChecking(false); onChanged.current(value);
  }
  async function sync(purchase: Purchase): Promise<Entitlements> {
    const existing = pending.current.get(purchase.id);
    if (existing) return existing;
    const operation = (async () => {
      if (!purchase.purchaseToken) throw new Error("Missing transaction");
      const result = await apiClient.syncApplePurchase({ signedTransactionInfo: purchase.purchaseToken, eventId: purchase.id });
      apply(result.entitlement);
      try { await finishTransaction({ purchase, isConsumable: false }); }
      catch {
        if (mounted.current) setMessage({ text: "Din adgang er opdateret, men App Store kunne ikke afslutte synkroniseringen. Prøv Gendan køb igen senere.", error: true });
        return result.entitlement;
      }
      if (mounted.current) setMessage({ text: result.entitlement.accessPlan === "pro" ? "Du har nu PRO. Alle dine fordele er klar." : "Købet er kontrolleret. Det giver ikke aktiv PRO-adgang lige nu.", error: result.entitlement.accessPlan !== "pro" });
      return result.entitlement;
    })();
    pending.current.set(purchase.id, operation);
    try { return await operation; } finally { pending.current.delete(purchase.id); }
  }
  async function refresh() {
    const requestRevision = ++revision.current;
    setChecking(true);
    try {
      const result = await apiClient.getAppBootstrap();
      if (mounted.current && revision.current === requestRevision) { apply(result.entitlements); setMessage(null); }
    } catch {
      if (mounted.current && revision.current === requestRevision) {
        setVerified(false);
        setMessage({ text: "Vi kunne ikke opdatere din adgang. Den senest hentede status vises. Prøv Opdater adgang igen.", error: true });
      }
    } finally {
      if (mounted.current && revision.current <= requestRevision + 1) setChecking(false);
    }
  }
  useEffect(() => { setCurrent(entitlements); }, [entitlements]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { mounted.current = false; listener.remove(); };
  }, [apiClient]);
  useEffect(() => {
    if (Platform.OS !== "ios" || !connected) return;
    void fetchProducts({ skus: productIds, type: "subs" }).catch(() => {
      if (mounted.current) setMessage({ text: "Prisen kunne ikke hentes fra App Store. Prøv igen om lidt.", error: true });
    });
  }, [connected, fetchProducts]);

  async function buy() {
    if (busy || checking || !verified || subscriptionPresentation(current).pro) return;
    setBusy(true); setMessage(null);
    const productId = selectedPlan === "yearly" ? yearlyProductId : monthlyProductId;
    try { await requestPurchase({ type: "subs", request: { apple: { sku: productId } } }); }
    catch { setBusy(false); setMessage({ text: "Købet kunne ikke startes. Prøv igen om lidt.", error: true }); }
  }
  async function restore() {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      await restorePurchases({ alsoPublishToEventListenerIOS: false, onlyIncludeActiveItemsIOS: true });
      const purchases = (await getStorePurchases({ alsoPublishToEventListenerIOS: false, onlyIncludeActiveItemsIOS: true })).filter(purchase => productIds.includes(purchase.productId));
      if (!purchases.length) setMessage({ text: "Der blev ikke fundet et aktivt PRO-køb på denne Apple-konto.", error: false });
      // Oldest first: the newest verified transaction determines the final access state.
      for (const purchase of purchases.sort((a, b) => a.transactionDate - b.transactionDate)) await sync(purchase);
    } catch { setMessage({ text: "Dine køb kunne ikke gendannes lige nu. Kontrollér forbindelsen, og prøv igen.", error: true }); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function manage() {
    setBusy(true);
    try {
      await showManageSubscriptionsIOS();
      // Apple may change auto-renewal while the native management UI is open.
      // Refresh the backend-backed entitlement when the user returns.
      await refresh();
    }
    catch { setMessage({ text: "Apples abonnementsstyring kunne ikke åbnes. Du kan også finde TestFlight-abonnementet under Indstillinger → Udvikler → Sandbox Account → Manage.", error: true }); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function retryStore() {
    setBusy(true);
    try {
      if (!connected && !(await reconnect())) throw new Error("Store unavailable");
      await fetchProducts({ skus: productIds, type: "subs" });
    } catch { setMessage({ text: "App Store er ikke tilgængelig lige nu. Prøv igen senere.", error: true }); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <SubscriptionView entitlements={current} monthlyPrice={subscriptions.find(item => item.id === monthlyProductId)?.displayPrice} yearlyPrice={subscriptions.find(item => item.id === yearlyProductId)?.displayPrice} selectedPlan={selectedPlan} onSelectPlan={setSelectedPlan}
    ios={Platform.OS === "ios"} connected={connected} checking={checking} verified={verified} busy={busy} message={message}
    onBack={onBack} onBuy={() => void buy()} onRestore={() => void restore()} onManage={() => void manage()}
    onRefresh={() => void refresh()} onRetryStore={() => void retryStore()} />;
}
