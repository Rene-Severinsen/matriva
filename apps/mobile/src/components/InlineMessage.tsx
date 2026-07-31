import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

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
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
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
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 8
  },
  errorPanel: {
    backgroundColor: theme.errorSoft,
    borderColor: theme.errorBorder,
    padding: 14,
    rowGap: 6
  },
  title: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "700"
  },
  message: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21
  },
  errorTitle: {
    color: theme.error,
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: theme.error,
    fontSize: 14,
    lineHeight: 21
  }
});
