import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import { createMatrivaApiClient } from "@matriva/api-client";
import { MATRIVA_FOUNDATION_VERSION } from "@matriva/shared";

const localApiBaseUrl = "http://127.0.0.1:4000";
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_MATRIVA_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiBaseUrl || localApiBaseUrl;
const usesLocalFallback = !configuredApiBaseUrl;

type SmokeAction =
  | "Check API"
  | "Load Bootstrap"
  | "Search Address Demo"
  | "Create House Draft Demo";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown smoke test error";
}

export default function App() {
  const apiClient = useMemo(
    () =>
      createMatrivaApiClient({
        baseUrl: apiBaseUrl
      }),
    []
  );
  const [loadingAction, setLoadingAction] = useState<SmokeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>({
    message: "Run a smoke check against the local Matriva API."
  });

  async function runSmokeAction(
    action: SmokeAction,
    request: () => Promise<unknown>
  ) {
    setLoadingAction(action);
    setError(null);

    try {
      setResult(await request());
    } catch (caughtError) {
      setError(errorMessage(caughtError));
    } finally {
      setLoadingAction(null);
    }
  }

  const prettyResult = JSON.stringify(result, null, 2);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Developer smoke view</Text>
        <Text style={styles.title}>Matriva</Text>
        <Text style={styles.body}>
          Temporary API verification view. This is not V1 product UI.
        </Text>

        <View style={styles.infoPanel}>
          <Text style={styles.label}>API base URL</Text>
          <Text style={styles.mono}>{apiClient.baseUrl}</Text>
          <Text style={styles.meta}>
            {usesLocalFallback
              ? "Using local fallback. Set EXPO_PUBLIC_MATRIVA_API_BASE_URL to override."
              : "Using EXPO_PUBLIC_MATRIVA_API_BASE_URL."}
          </Text>
          <Text style={styles.meta}>
            Shared version {MATRIVA_FOUNDATION_VERSION}
          </Text>
        </View>

        <View style={styles.actions}>
          <SmokeButton
            label="Check API"
            loading={loadingAction === "Check API"}
            disabled={loadingAction !== null}
            onPress={() =>
              void runSmokeAction("Check API", () => apiClient.getHealth())
            }
          />
          <SmokeButton
            label="Load Bootstrap"
            loading={loadingAction === "Load Bootstrap"}
            disabled={loadingAction !== null}
            onPress={() =>
              void runSmokeAction("Load Bootstrap", () =>
                apiClient.getBootstrap()
              )
            }
          />
          <SmokeButton
            label="Search Address Demo"
            loading={loadingAction === "Search Address Demo"}
            disabled={loadingAction !== null}
            onPress={() =>
              void runSmokeAction("Search Address Demo", () =>
                apiClient.searchAddresses("Rådhuspladsen 1")
              )
            }
          />
          <SmokeButton
            label="Create House Draft Demo"
            loading={loadingAction === "Create House Draft Demo"}
            disabled={loadingAction !== null}
            onPress={() =>
              void runSmokeAction("Create House Draft Demo", () =>
                apiClient.createHouseDraft({
                  source: "DAWA",
                  sourceAddressId: "2f33a74d-1893-4ef5-a6b4-02ebc0fe1785",
                  sourceAccessAddressId:
                    "0a3f5093-f86f-32b8-e044-0003ba298018",
                  label: "Rådhuspladsen 1, 1. 1, 8362 Hørning"
                })
              )
            }
          />
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.label}>Status</Text>
          <Text style={error ? styles.error : styles.meta}>
            {error ?? (loadingAction ? `Running ${loadingAction}...` : "Ready")}
          </Text>
        </View>

        <View style={styles.resultPanel}>
          <Text style={styles.label}>Latest JSON result</Text>
          <Text style={styles.resultText}>{prettyResult}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SmokeButtonProps = {
  label: SmokeAction;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
};

function SmokeButton({ label, loading, disabled, onPress }: SmokeButtonProps) {
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
  screen: {
    flex: 1,
    backgroundColor: "#F7F4EF"
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    rowGap: 16
  },
  eyebrow: {
    color: "#7A4F18",
    fontSize: 14,
    fontWeight: "700"
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
  actions: {
    rowGap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: "#246B5A",
    borderRadius: 8,
    columnGap: 10,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  buttonPressed: {
    backgroundColor: "#1C5447"
  },
  buttonDisabled: {
    opacity: 0.62
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  statusPanel: {
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 6
  },
  resultPanel: {
    backgroundColor: "#17211D",
    borderRadius: 8,
    padding: 14,
    rowGap: 10
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
  },
  error: {
    color: "#A33A2B",
    fontSize: 14,
    lineHeight: 21
  },
  resultText: {
    color: "#F7F4EF",
    fontFamily: "Courier",
    fontSize: 12,
    lineHeight: 17
  }
});
