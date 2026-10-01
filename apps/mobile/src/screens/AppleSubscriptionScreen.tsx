import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useIAP, type Purchase } from "expo-iap";

import type { MatrivaApiClient } from "@matriva/api-client";

const productId = process.env.EXPO_PUBLIC_MATRIVA_APPLE_PRO_PRODUCT_ID?.trim() || "matriva.pro.monthly";

export function AppleSubscriptionScreen({ apiClient, onBack }: { apiClient: MatrivaApiClient; onBack: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const syncAndFinish = useCallback(async (purchase: Purchase) => {
    if (Platform.OS !== "ios") return;
    if (!purchase.purchaseToken) {
      setMessage("Apple returnerede ingen signerede transaktionsdata.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.syncApplePurchase({ signedTransactionInfo: purchase.purchaseToken, eventId: purchase.id });
      await finishTransaction({ purchase, isConsumable: false });
      setMessage(result.entitlement.plan === "pro" ? "PRO-adgangen er aktiveret." : "Købet er modtaget og behandles.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple-købet kunne ikke synkroniseres.");
    } finally {
      setBusy(false);
    }
  }, [apiClient]);
  const { connected, subscriptions, availablePurchases, fetchProducts, requestPurchase, restorePurchases, getAvailablePurchases, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase) => { void syncAndFinish(purchase); },
    onPurchaseError: (error) => setMessage(error.message || "Apple-købet blev ikke gennemført.")
  });
  const subscription = useMemo(() => subscriptions.find((item) => item.id === productId), [subscriptions]);

  useEffect(() => {
    if (Platform.OS === "ios" && connected) void fetchProducts({ skus: [productId], type: "subs" }).catch(() => setMessage("Apple-produktet kunne ikke indlæses endnu."));
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (!restorePending || availablePurchases.length === 0) return;
    setRestorePending(false);
    void Promise.all(availablePurchases.map((purchase) => syncAndFinish(purchase)));
  }, [availablePurchases, restorePending, syncAndFinish]);

  async function buy() {
    setMessage(null);
    try {
      await requestPurchase({ type: "subs", request: { apple: { sku: productId } } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple-købet kunne ikke startes.");
    }
  }

  async function restore() {
    setBusy(true);
    setMessage(null);
    try {
      await restorePurchases();
      await getAvailablePurchases();
      setRestorePending(true);
      if (availablePurchases.length === 0) setMessage("Apple undersøger tidligere køb...");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Apple-købene kunne ikke gendannes.");
    } finally {
      setBusy(false);
    }
  }

  if (Platform.OS !== "ios") {
    return <View style={styles.stack}><Text style={styles.title}>Abonnement</Text><Text style={styles.body}>Apple-abonnementer kan testes fra en iPhone/iPad-build. Google Play er ikke aktiveret.</Text><Pressable onPress={onBack} style={styles.secondary}><Text style={styles.secondaryText}>Tilbage</Text></Pressable></View>;
  }

  return <View style={styles.stack}>
    <View style={styles.header}><Text style={styles.title}>Abonnement</Text><Pressable onPress={onBack}><Text style={styles.link}>Tilbage</Text></Pressable></View>
    <Text style={styles.body}>PRO købes gennem App Store. Matriva aktiverer først adgangen, når backend har verificeret Apples signerede transaktion.</Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Matriva PRO</Text>
      <Text style={styles.body}>{subscription?.displayPrice ?? "Pris vises fra App Store"}</Text>
      <Pressable accessibilityRole="button" disabled={busy || !connected || !subscription} onPress={() => void buy()} style={[styles.primary, busy || !connected || !subscription ? styles.disabled : null]}><Text style={styles.primaryText}>{busy ? "Arbejder..." : connected ? "Køb PRO" : "Forbinder til App Store..."}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void restore()} style={styles.secondary}><Text style={styles.secondaryText}>Gendan køb</Text></Pressable>
    </View>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 16, padding: 20 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { color: "#17352B", fontSize: 24, fontWeight: "700" },
  card: { backgroundColor: "#F3F6F4", borderRadius: 16, gap: 12, padding: 18 },
  cardTitle: { color: "#17352B", fontSize: 18, fontWeight: "700" },
  body: { color: "#53645D", fontSize: 15, lineHeight: 22 },
  primary: { alignItems: "center", backgroundColor: "#1C6B4D", borderRadius: 12, padding: 14 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondary: { alignItems: "center", borderColor: "#B6C6BE", borderRadius: 12, borderWidth: 1, padding: 13 },
  secondaryText: { color: "#1C6B4D", fontSize: 15, fontWeight: "600" },
  link: { color: "#1C6B4D", fontSize: 15, fontWeight: "600" },
  message: { color: "#7A3E16", fontSize: 14 },
  disabled: { opacity: 0.45 }
});
