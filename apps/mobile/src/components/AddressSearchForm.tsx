import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

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
        placeholderTextColor="#69746F"
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
      {loading ? <ActivityIndicator color="#FFFFFF" /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
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
  }
});
