import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { createMatrivaApiClient } from "@matriva/api-client";
import {
  MATRIVA_FOUNDATION_VERSION,
  type AddressSuggestion,
  type HomeCard,
  type HouseDraftResponse,
  type SelectedAddressInput
} from "@matriva/shared";

const localApiBaseUrl = "http://127.0.0.1:4000";
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_MATRIVA_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiBaseUrl || localApiBaseUrl;
const usesLocalFallback = !configuredApiBaseUrl;

type LoadingAction = "search" | "create";

function selectedAddressInput(
  suggestion: AddressSuggestion
): SelectedAddressInput {
  return {
    source: suggestion.source,
    sourceAddressId: suggestion.sourceAddressId,
    sourceAccessAddressId: suggestion.sourceAccessAddressId,
    label: suggestion.label
  };
}

function userFacingError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Kan ikke kontakte lokal Matriva API.";
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  ) {
    return "Kan ikke kontakte lokal Matriva API. Tjek at API-serveren kører, og at base URL passer til din simulator eller device.";
  }

  return `Matriva API svarede med en fejl: ${error.message}`;
}

export default function App() {
  const apiClient = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: apiBaseUrl
      }),
    []
  );

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<AddressSuggestion | null>(null);
  const [draftResponse, setDraftResponse] =
    useState<HouseDraftResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const isSearching = loadingAction === "search";
  const isCreating = loadingAction === "create";
  const isBusy = loadingAction !== null;
  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= 2 && !isBusy;
  const canCreate = selectedAddress !== null && !isBusy;

  async function searchAddressSuggestions() {
    if (trimmedQuery.length < 2) {
      setError("Skriv mindst 2 tegn for at søge efter en adresse.");
      setHasSearched(false);
      setSuggestions([]);
      setSelectedAddress(null);
      setDraftResponse(null);
      return;
    }

    setLoadingAction("search");
    setError(null);
    setDraftResponse(null);
    setSelectedAddress(null);

    try {
      const response = await apiClient.searchAddresses(trimmedQuery);
      setSuggestions(response.suggestions);
      setHasSearched(true);
    } catch (caughtError) {
      setSuggestions([]);
      setHasSearched(false);
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  async function createFirstHouseDraft() {
    if (!selectedAddress) {
      setError("Vælg en adresse, før du opretter første husoverblik.");
      return;
    }

    setLoadingAction("create");
    setError(null);

    try {
      setDraftResponse(
        await apiClient.createHouseDraft(selectedAddressInput(selectedAddress))
      );
    } catch (caughtError) {
      setDraftResponse(null);
      setError(userFacingError(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

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
          <Text style={styles.mono}>{apiClient.baseUrl}</Text>
          <Text style={styles.meta}>
            {usesLocalFallback
              ? "Bruger lokal fallback. Sæt EXPO_PUBLIC_MATRIVA_API_BASE_URL for simulator eller fysisk device."
              : "Bruger EXPO_PUBLIC_MATRIVA_API_BASE_URL."}
          </Text>
          <Text style={styles.meta}>
            Shared version {MATRIVA_FOUNDATION_VERSION}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find adresse</Text>
          <TextInput
            accessibilityLabel="Adresse"
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isBusy}
            onChangeText={(nextQuery) => {
              setQuery(nextQuery);
              setError(null);
            }}
            onSubmitEditing={() => {
              if (canSearch) {
                void searchAddressSuggestions();
              }
            }}
            placeholder="Skriv vejnavn og nummer"
            placeholderTextColor="#69746F"
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          <PrimaryButton
            label="Søg adresse"
            loading={isSearching}
            disabled={!canSearch}
            onPress={() => void searchAddressSuggestions()}
          />
        </View>

        {error ? (
          <View style={styles.errorPanel} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Der opstod et problem</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <AddressSuggestions
          hasSearched={hasSearched}
          isSearching={isSearching}
          selectedAddress={selectedAddress}
          suggestions={suggestions}
          onSelect={(suggestion) => {
            setSelectedAddress(suggestion);
            setDraftResponse(null);
            setError(null);
          }}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Første husoverblik</Text>
          <Text style={styles.meta}>
            Vælg en adresse for at oprette et midlertidigt house draft via
            Matriva API.
          </Text>
          <PrimaryButton
            label="Opret første husoverblik"
            loading={isCreating}
            disabled={!canCreate}
            onPress={() => void createFirstHouseDraft()}
          />
        </View>

        {draftResponse ? <HouseDraftPreview response={draftResponse} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type PrimaryButtonProps = {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
};

function PrimaryButton({
  label,
  loading,
  disabled,
  onPress
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null
      ]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

type AddressSuggestionsProps = {
  hasSearched: boolean;
  isSearching: boolean;
  selectedAddress: AddressSuggestion | null;
  suggestions: AddressSuggestion[];
  onSelect: (suggestion: AddressSuggestion) => void;
};

function AddressSuggestions({
  hasSearched,
  isSearching,
  selectedAddress,
  suggestions,
  onSelect
}: AddressSuggestionsProps) {
  if (isSearching) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color="#245D52" />
        <Text style={styles.meta}>Søger efter adresser...</Text>
      </View>
    );
  }

  if (hasSearched && suggestions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Ingen adresser fundet</Text>
        <Text style={styles.meta}>
          Prøv med vejnavn, husnummer og eventuelt by.
        </Text>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Adresseforslag vises her</Text>
        <Text style={styles.meta}>
          Mobilappen kalder Matriva API. Den kalder ikke DAWA direkte.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Vælg adresse</Text>
      {suggestions.map((suggestion) => {
        const isSelected = selectedAddress?.id === suggestion.id;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={suggestion.id}
            onPress={() => onSelect(suggestion)}
            style={({ pressed }) => [
              styles.suggestionCard,
              isSelected ? styles.suggestionCardSelected : null,
              pressed ? styles.suggestionCardPressed : null
            ]}
          >
            <Text style={styles.suggestionLabel}>{suggestion.label}</Text>
            <Text style={styles.meta}>Kilde: {suggestion.source}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type HouseDraftPreviewProps = {
  response: HouseDraftResponse;
};

function HouseDraftPreview({ response }: HouseDraftPreviewProps) {
  const { houseDraft, cards } = response;

  return (
    <View style={styles.section}>
      <View style={styles.summaryPanel}>
        <Text style={styles.previewLabel}>Development preview</Text>
        <Text style={styles.sectionTitle}>{houseDraft.profile.displayName}</Text>
        <Text style={styles.bodySmall}>{houseDraft.profile.addressLabel}</Text>
        <Text style={styles.meta}>
          House draft {houseDraft.id} er midlertidigt og bruger ikke database,
          auth eller BBR/Datafordeler endnu.
        </Text>
      </View>

      <View style={styles.cardsSection}>
        <Text style={styles.sectionTitle}>Første backend-kort</Text>
        {cards.map((card) => (
          <HomeCardPreview card={card} key={card.id} />
        ))}
      </View>
    </View>
  );
}

type HomeCardPreviewProps = {
  card: HomeCard;
};

function HomeCardPreview({ card }: HomeCardPreviewProps) {
  return (
    <View style={styles.homeCard}>
      <Text style={styles.cardMeta}>
        Skeleton card · {card.type} · {card.severity}
      </Text>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.bodySmall}>{card.shortExplanation}</Text>
      <Text style={styles.meta}>{card.fallbackText}</Text>
    </View>
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
  bodySmall: {
    color: "#33423C",
    fontSize: 15,
    lineHeight: 22
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
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: "#B8C3BD",
    borderRadius: 8,
    borderWidth: 1,
    color: "#17211D",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: "#245D52",
    borderRadius: 8,
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  buttonPressed: {
    backgroundColor: "#1D4B43"
  },
  buttonDisabled: {
    opacity: 0.56
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  emptyState: {
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 8
  },
  emptyTitle: {
    color: "#17211D",
    fontSize: 17,
    fontWeight: "700"
  },
  suggestionCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 62,
    padding: 14,
    rowGap: 6
  },
  suggestionCardSelected: {
    borderColor: "#245D52",
    borderWidth: 2
  },
  suggestionCardPressed: {
    backgroundColor: "#EEF6F3"
  },
  suggestionLabel: {
    color: "#17211D",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22
  },
  errorPanel: {
    backgroundColor: "#FFF1EE",
    borderColor: "#E3A093",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 6
  },
  errorTitle: {
    color: "#8E2F23",
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: "#8E2F23",
    fontSize: 14,
    lineHeight: 21
  },
  summaryPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  cardsSection: {
    rowGap: 10
  },
  homeCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  cardMeta: {
    color: "#69746F",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#17211D",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23
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
