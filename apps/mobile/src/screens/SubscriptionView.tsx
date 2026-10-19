import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Entitlements } from "@matriva/shared";
import { theme } from "../theme";
import { subscriptionPresentation } from "./subscriptionPresentation";

export type SubscriptionViewProps = {
  entitlements: Entitlements; price: string | undefined; ios: boolean; connected: boolean; storeSupported?: boolean;
  checking: boolean; verified: boolean; busy: boolean;
  message: { text: string; error: boolean } | null;
  onBack: () => void; onBuy: () => void; onRestore: () => void;
  onManage: () => void; onRefresh: () => void; onRetryStore: () => void;
};

export function SubscriptionView(props: SubscriptionViewProps) {
  const { entitlements, price, ios, busy, checking, message } = props;
  const storeSupported = props.storeSupported ?? ios;
  const state = subscriptionPresentation(entitlements);
  const date = entitlements.expiresAt ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entitlements.expiresAt)) : null;
  const disabled = busy || checking;
  const buyDisabled = disabled || !props.verified || !props.connected || !price;
  const usage = entitlements.usage;
  const features = [
    { icon: "⌂", title: state.pro ? "Dine boliger" : "Plads til flere boliger", text: state.pro ? `${usage.houses.active} tilføjet${usage.houses.limit === null ? " · ingen boliggrænse" : ` · plads til ${usage.houses.limit}`}` : `Free: ${usage.houses.limit ?? "ubegrænset antal"} bolig${usage.houses.limit === 1 ? "" : "er"}` },
    { icon: "▤", title: state.pro ? "Dine dokumenter" : "Mere plads til dokumenter", text: state.pro ? `${usage.documents.active} gemt${usage.documents.limit === null ? " · ingen dokumentgrænse" : ` · plads til ${usage.documents.limit}`}` : `Free: ${usage.documents.limit ?? "ubegrænset antal"} dokumenter` },
    { icon: "✓", title: state.pro ? "Dine aktive opgaver" : "Plads til flere opgaver", text: state.pro ? `${usage.tasks.active} aktive${usage.tasks.limit === null ? " · ingen opgavegrænse" : ` · plads til ${usage.tasks.limit}`}` : `Free: ${usage.tasks.limit ?? "ubegrænset antal"} egne aktive opgaver` }
  ];
  return <View style={styles.page}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Tilbage til Mere" onPress={props.onBack} style={styles.back}><Text style={styles.backText}>‹ Tilbage</Text></Pressable><Text accessibilityRole="header" style={styles.headerTitle}>Abonnement</Text></View>
    <View style={styles.hero}>
      <View style={styles.badge}><Text style={styles.badgeText}>{state.pro ? "✓  " : ""}{state.badge}</Text></View>
      <Text style={styles.wordmark}>Matriva <Text style={styles.pro}>PRO</Text></Text>
      <Text accessibilityRole="header" style={styles.heroTitle}>{state.title}</Text>
      <Text style={styles.heroBody}>{state.description}</Text>
      {state.pro ? <View style={styles.heroFooter}><View><Text style={styles.heroLabel}>{state.complimentary ? "Din adgang" : "Dit abonnement"}</Text><Text style={styles.heroValue}>{state.complimentary ? "Gratis PRO" : state.store ? "PRO via App Store" : "PRO-adgang"}</Text></View><View style={styles.dateBlock}><Text style={styles.heroLabel}>{date ? "Adgang indtil" : "Varighed"}</Text><Text style={styles.heroValue}>{date ?? (state.complimentary ? "Permanent" : "Ingen slutdato oplyst")}</Text></View></View> : null}
    </View>
    {checking ? <View style={styles.loading}><ActivityIndicator color={theme.primaryPressed} /><Text style={styles.body}>Opdaterer din adgang…</Text></View> : null}
    {state.notice ? <View style={styles.warning}><Text style={styles.warningText}>{state.notice}</Text></View> : null}
    {message ? <View accessibilityLiveRegion="polite" accessibilityRole={message.error ? "alert" : "text"} style={[styles.notice, message.error ? styles.warning : null]}><Text style={message.error ? styles.warningText : styles.noticeText}>{message.text}</Text></View> : null}
    {!state.pro && !state.issue ? <View style={styles.card}>
      <View style={styles.priceRow}><View><Text style={styles.sectionTitle}>Matriva PRO</Text><Text style={styles.body}>Månedligt abonnement</Text></View><View><Text style={styles.price}>{storeSupported ? price ?? "Henter pris…" : "PRO"}</Text>{storeSupported && price ? <Text style={styles.pricePeriod}>pr. måned</Text> : null}</View></View>
      {storeSupported ? <>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: buyDisabled }} disabled={buyDisabled} onPress={props.onBuy} style={({ pressed }) => [styles.primary, buyDisabled ? styles.disabled : null, pressed ? styles.pressed : null]}><Text style={styles.primaryText}>{busy ? "Et øjeblik…" : checking ? "Tjekker din adgang…" : price ? "Få Matriva PRO" : "Venter på App Store…"}</Text></Pressable>
        {!price && !checking ? <Pressable accessibilityRole="button" disabled={disabled} onPress={props.onRetryStore} style={styles.textButton}><Text style={styles.link}>Prøv at hente prisen igen</Text></Pressable> : null}
        <Text style={styles.finePrint}>Betales via App Store. Abonnementet fornyes automatisk hver måned, indtil du opsiger det. Du kan administrere og opsige det i dine Apple-abonnementer.</Text>
      </> : <Text style={styles.body}>{ios ? "Køb og gendannelse er ikke aktiveret i denne udviklingsversion. Brug Matriva fra TestFlight til at teste App Store-køb." : "Køb af PRO er endnu ikke tilgængeligt på denne enhed."}</Text>}
    </View> : null}
    {state.store && ios ? <View style={styles.card}><Text style={styles.sectionTitle}>{state.pro ? "Dit abonnement er samlet hos Apple" : "Se dit abonnement hos Apple"}</Text><Text style={styles.body}>Se betalinger, fornyelse og muligheder for opsigelse i App Store.</Text>{storeSupported ? <Pressable accessibilityRole="button" disabled={disabled} onPress={props.onManage} style={[styles.primary, disabled ? styles.disabled : null]}><Text style={styles.primaryText}>Administrer abonnement ↗</Text></Pressable> : <Text style={styles.body}>Administrer abonnementet i Matriva fra TestFlight eller på din iPhone under Indstillinger → dit navn → Abonnementer.</Text>}</View> : null}
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{state.pro ? "Det har du adgang til" : "Et større overblik med PRO"}</Text>
      {features.map((item, index) => <View key={item.title} style={[styles.feature, index > 0 ? styles.featureBorder : null]}><View accessibilityElementsHidden style={styles.featureIcon}><Text style={styles.featureSymbol}>{item.icon}</Text></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>{item.title}</Text><Text style={styles.body}>{item.text}</Text></View></View>)}
    </View>
    <View style={styles.footer}>
      {storeSupported ? <Pressable accessibilityRole="button" disabled={disabled || !props.connected} onPress={props.onRestore} style={styles.textButton}><Text style={[styles.link, disabled || !props.connected ? styles.disabled : null]}>Gendan køb</Text></Pressable> : null}
      <Pressable accessibilityRole="button" disabled={disabled} onPress={props.onRefresh} style={styles.textButton}><Text style={styles.link}>Opdater adgang</Text></Pressable>
    </View>
    <Text style={styles.footerNote}>{state.complimentary && state.pro ? "Din gratis adgang kræver ikke et abonnement hos Apple." : storeSupported ? "Har du allerede købt PRO på en anden enhed? Brug samme Apple-konto og vælg Gendan køb." : "Din adgang følger din Matriva-konto på tværs af enheder."}</Text>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 18, paddingVertical: 8, paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 2 },
  headerTitle: { fontSize: 21, fontWeight: "700", color: "#173D32" },
  back: { minHeight: 44, justifyContent: "center", paddingRight: 8 }, backText: { fontSize: 16, color: theme.primaryPressed, fontWeight: "600" },
  hero: { backgroundColor: "#123F33", borderRadius: 26, padding: 24, gap: 14 },
  badge: { alignSelf: "flex-start", borderRadius: 30, backgroundColor: "#D8F3DF", paddingHorizontal: 12, paddingVertical: 7 }, badgeText: { color: "#164A32", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  wordmark: { color: "#F0FAF5", fontSize: 19, fontWeight: "600" }, pro: { color: "#AEE6C5", fontWeight: "800" },
  heroTitle: { color: "#FFFFFF", fontSize: 31, lineHeight: 37, fontWeight: "700", letterSpacing: -0.6 },
  heroBody: { color: "#DAEAE3", fontSize: 15, lineHeight: 23 },
  heroFooter: { borderTopWidth: 1, borderTopColor: "#416458", paddingTop: 18, marginTop: 4, gap: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  heroLabel: { color: "#BDD5C9", fontSize: 12, marginBottom: 5 }, heroValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" }, dateBlock: { flexShrink: 1 },
  card: { backgroundColor: theme.surface, borderRadius: 22, padding: 21, gap: 15, borderWidth: 1, borderColor: "#E0E9E3" },
  sectionTitle: { color: "#173D32", fontSize: 18, fontWeight: "700", flexShrink: 1 },
  feature: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }, featureBorder: { borderTopWidth: 1, borderTopColor: "#EDF1EE", paddingTop: 19 }, featureIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EDF5EF", alignItems: "center", justifyContent: "center" }, featureSymbol: { color: theme.primaryPressed, fontSize: 24 }, featureCopy: { flex: 1, gap: 4 }, featureTitle: { fontWeight: "600", color: "#234C3E", fontSize: 16 },
  body: { color: "#5F6F67", fontSize: 14, lineHeight: 21 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14 }, price: { fontSize: 25, fontWeight: "700", color: "#173D32" }, pricePeriod: { fontSize: 12, color: theme.muted, marginTop: 3 },
  primary: { minHeight: 52, borderRadius: 15, backgroundColor: "#176649", justifyContent: "center", alignItems: "center", padding: 15 }, primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center" }, pressed: { backgroundColor: "#104D37" }, disabled: { opacity: 0.45 },
  finePrint: { color: "#617168", fontSize: 12, lineHeight: 19 },
  footer: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 12 }, textButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }, link: { color: theme.primaryPressed, fontSize: 14, fontWeight: "600", textAlign: "center" }, footerNote: { fontSize: 12, lineHeight: 19, color: theme.muted, textAlign: "center", paddingHorizontal: 12 },
  loading: { flexDirection: "row", alignItems: "center", gap: 10 }, notice: { backgroundColor: "#E6F3ED", padding: 16, borderRadius: 15 }, noticeText: { color: "#164B36", lineHeight: 21, fontSize: 14 }, warning: { backgroundColor: "#FFF3DD", padding: 16, borderRadius: 15 }, warningText: { color: "#704419", fontSize: 14, lineHeight: 21 }
});
