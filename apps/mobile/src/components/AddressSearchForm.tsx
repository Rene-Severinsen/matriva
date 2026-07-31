import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { theme } from "../theme";

type AddressSearchFormProps = {
  query: string;
  isBusy: boolean;
  isSearching: boolean;
  canSearch: boolean;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
};

export function AddressSearchForm({
  query,
  isBusy,
  isSearching,
  canSearch,
  onQueryChange,
  onSearch
}: AddressSearchFormProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Find adresse</Text>
      <TextInput
        accessibilityLabel="Adresse"
        autoCapitalize="words"
        autoCorrect={false}
        editable={!isBusy}
        onChangeText={onQueryChange}
        onSubmitEditing={() => {
          if (canSearch) {
            onSearch();
          }
        }}
        placeholder="Skriv vejnavn og nummer"
        placeholderTextColor={theme.muted}
        returnKeyType="search"
        style={styles.input}
        value={query}
      />
      <PrimaryButton
        label="Søg adresse"
        loading={isSearching}
        disabled={!canSearch}
        onPress={onSearch}
      />
    </View>
  );
}

type PrimaryButtonProps = {
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
};

export function PrimaryButton({
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
      {loading ? <ActivityIndicator color={theme.surface} /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    rowGap: 12
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700"
  },
  input: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.primary,
    borderRadius: 8,
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  buttonPressed: {
    backgroundColor: theme.primaryPressed
  },
  buttonDisabled: {
    opacity: 0.56
  },
  buttonText: {
    color: theme.surface,
    fontSize: 16,
    fontWeight: "700"
  }
});
