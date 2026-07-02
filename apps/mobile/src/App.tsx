import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { createMatrivaApiClient } from "@matriva/api-client";
import { MATRIVA_FOUNDATION_VERSION } from "@matriva/shared";

const apiClient = createMatrivaApiClient({
  baseUrl: "http://localhost:4000"
});

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Matriva</Text>
        <Text style={styles.title}>Clean foundation</Text>
        <Text style={styles.body}>
          Native-first Expo skeleton for iOS and Android.
        </Text>
        <Text style={styles.meta}>
          Shared version {MATRIVA_FOUNDATION_VERSION}
        </Text>
        <Text style={styles.meta}>
          API client ready: {apiClient.baseUrl}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F4EF"
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24
  },
  eyebrow: {
    color: "#246B5A",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10
  },
  title: {
    color: "#17211D",
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 12
  },
  body: {
    color: "#33423C",
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 28
  },
  meta: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 22
  }
});
