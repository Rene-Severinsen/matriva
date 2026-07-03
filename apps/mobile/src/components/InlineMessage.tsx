import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type InlineMessageProps = {
  title?: string;
  message: string;
  tone?: "neutral" | "error";
  loading?: boolean;
};

export function InlineMessage({
  title,
  message,
  tone = "neutral",
  loading = false
}: InlineMessageProps) {
  const isError = tone === "error";

  return (
    <View
      accessibilityRole={isError ? "alert" : undefined}
      style={[styles.panel, isError ? styles.errorPanel : null]}
    >
      {loading ? <ActivityIndicator color="#245D52" /> : null}
      {title ? (
        <Text style={isError ? styles.errorTitle : styles.title}>{title}</Text>
      ) : null}
      <Text style={isError ? styles.errorText : styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 8
  },
  errorPanel: {
    backgroundColor: "#FFF1EE",
    borderColor: "#E3A093",
    padding: 14,
    rowGap: 6
  },
  title: {
    color: "#17211D",
    fontSize: 17,
    fontWeight: "700"
  },
  message: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
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
  }
});
