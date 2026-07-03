import { StatusBar } from "expo-status-bar";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { MATRIVA_FOUNDATION_VERSION } from "@matriva/shared";

import {
  AddressSearchForm,
  PrimaryButton
} from "../components/AddressSearchForm";
import { AddressSuggestionList } from "../components/AddressSuggestionList";
import { HomeCardPreviewList } from "../components/HomeCardPreviewList";
import { HouseDraftSummary } from "../components/HouseDraftSummary";
import { InlineMessage } from "../components/InlineMessage";
import { useAddressOnboardingPreview } from "../hooks/useAddressOnboardingPreview";

export function AddressOnboardingPreviewScreen() {
  const onboarding = useAddressOnboardingPreview();

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.previewLabel}>Development preview</Text>
          <Text style={styles.title}>Matriva</Text>
          <Text style={styles.body}>
            Start med at finde dit hus. Matriva bruger adressen til at oprette
            et første overblik.
          </Text>
        </View>

        <View style={styles.infoPanel}>
          <Text style={styles.label}>Lokal API</Text>
          <Text style={styles.mono}>{onboarding.apiBaseUrl}</Text>
          <Text style={styles.meta}>
            {onboarding.usesLocalFallback
              ? "Bruger lokal fallback. Sæt EXPO_PUBLIC_MATRIVA_API_BASE_URL for simulator eller fysisk device."
              : "Bruger EXPO_PUBLIC_MATRIVA_API_BASE_URL."}
          </Text>
          <Text style={styles.meta}>
            Shared version {MATRIVA_FOUNDATION_VERSION}
          </Text>
        </View>

        <AddressSearchForm
          query={onboarding.query}
          isBusy={onboarding.isBusy}
          isSearching={onboarding.isSearching}
          canSearch={onboarding.canSearch}
          onQueryChange={onboarding.updateQuery}
          onSearch={() => void onboarding.searchAddressSuggestions()}
        />

        {onboarding.error ? (
          <InlineMessage
            title="Der opstod et problem"
            message={onboarding.error}
            tone="error"
          />
        ) : null}

        <AddressSuggestionList
          hasSearched={onboarding.hasSearched}
          isSearching={onboarding.isSearching}
          selectedAddress={onboarding.selectedAddress}
          suggestions={onboarding.suggestions}
          onSelect={onboarding.selectAddress}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Første husoverblik</Text>
          <Text style={styles.meta}>
            Vælg en adresse for at oprette et midlertidigt house draft via
            Matriva API.
          </Text>
          <PrimaryButton
            label="Opret første husoverblik"
            loading={onboarding.isCreating}
            disabled={!onboarding.canCreate}
            onPress={() => void onboarding.createFirstHouseDraft()}
          />
        </View>

        {onboarding.draftResponse ? (
          <View style={styles.section}>
            <HouseDraftSummary
              houseDraft={onboarding.draftResponse.houseDraft}
            />
            <HomeCardPreviewList cards={onboarding.draftResponse.cards} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F6F1"
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    rowGap: 18
  },
  header: {
    rowGap: 8
  },
  previewLabel: {
    alignSelf: "flex-start",
    backgroundColor: "#E6F1ED",
    borderRadius: 8,
    color: "#245D52",
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    fontWeight: "700"
  },
  body: {
    color: "#33423C",
    fontSize: 16,
    lineHeight: 23
  },
  infoPanel: {
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 6
  },
  section: {
    rowGap: 12
  },
  sectionTitle: {
    color: "#17211D",
    fontSize: 20,
    fontWeight: "700"
  },
  label: {
    color: "#5B6862",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  meta: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
  },
  mono: {
    color: "#17211D",
    fontFamily: "Courier",
    fontSize: 14
  }
});
