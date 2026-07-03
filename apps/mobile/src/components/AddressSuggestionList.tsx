import { Pressable, StyleSheet, Text, View } from "react-native";

import { type AddressSuggestion } from "@matriva/shared";

import { InlineMessage } from "./InlineMessage";

type AddressSuggestionListProps = {
  hasSearched: boolean;
  isSearching: boolean;
  selectedAddress: AddressSuggestion | null;
  suggestions: AddressSuggestion[];
  onSelect: (suggestion: AddressSuggestion) => void;
};

export function AddressSuggestionList({
  hasSearched,
  isSearching,
  selectedAddress,
  suggestions,
  onSelect
}: AddressSuggestionListProps) {
  if (isSearching) {
    return <InlineMessage message="Søger efter adresser..." loading />;
  }

  if (hasSearched && suggestions.length === 0) {
    return (
      <InlineMessage
        title="Ingen adresser fundet"
        message="Prøv med vejnavn, husnummer og eventuelt by."
      />
    );
  }

  if (suggestions.length === 0) {
    return (
      <InlineMessage
        title="Adresseforslag vises her"
        message="Mobilappen kalder Matriva API. Den kalder ikke DAWA direkte."
      />
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

const styles = StyleSheet.create({
  section: {
    rowGap: 12
  },
  sectionTitle: {
    color: "#17211D",
    fontSize: 20,
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
  meta: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
  }
});
