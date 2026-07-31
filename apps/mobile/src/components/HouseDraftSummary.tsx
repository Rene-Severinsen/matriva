import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

import { type HouseDraft } from "@matriva/shared";

type HouseDraftSummaryProps = {
  houseDraft: HouseDraft;
};

export function HouseDraftSummary({ houseDraft }: HouseDraftSummaryProps) {
  return (
    <View style={styles.summaryPanel}>
      <Text style={styles.previewLabel}>Development preview</Text>
      <Text style={styles.sectionTitle}>{houseDraft.profile.displayName}</Text>
      <Text style={styles.bodySmall}>{houseDraft.profile.addressLabel}</Text>
      <Text style={styles.meta}>
        House draft {houseDraft.id} er midlertidigt og bruger ikke database,
        auth eller BBR/Datafordeler endnu.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryPanel: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  previewLabel: {
    alignSelf: "flex-start",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    color: theme.primaryPressed,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700"
  },
  bodySmall: {
    color: theme.subtle,
    fontSize: 15,
    lineHeight: 22
  },
  meta: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21
  }
});
