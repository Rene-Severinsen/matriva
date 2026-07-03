import { StyleSheet, Text, View } from "react-native";

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
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
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
  sectionTitle: {
    color: "#17211D",
    fontSize: 20,
    fontWeight: "700"
  },
  bodySmall: {
    color: "#33423C",
    fontSize: 15,
    lineHeight: 22
  },
  meta: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
  }
});
