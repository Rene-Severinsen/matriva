import { StyleSheet, Text, View } from "react-native";

import { type EnrichHouseDraftResponse } from "@matriva/shared";

type HouseEnrichmentSummaryProps = {
  response: EnrichHouseDraftResponse;
};

export function HouseEnrichmentSummary({
  response
}: HouseEnrichmentSummaryProps) {
  const { enrichment, profilePreview } = response;
  const profileRows = profilePreview
    ? [
        ["Adresse", profilePreview.addressLabel],
        ["Boligtype", profilePreview.propertyType],
        ["Byggeår", profilePreview.buildYear?.toString()],
        ["Boligareal", profilePreview.livingAreaM2?.toString()],
        ["Opvarmning", profilePreview.heatingType],
        ["Tagtype", profilePreview.roofType]
      ].filter((row): row is [string, string] => typeof row[1] === "string")
    : [];

  return (
    <View style={styles.panel}>
      <Text style={styles.previewLabel}>Development preview</Text>
      <Text style={styles.sectionTitle}>Boligdata preview</Text>
      <Text style={styles.bodySmall}>
        Dette er en backend-owned skeleton response og ikke verificerede
        BBR-data.
      </Text>
      <Text style={styles.meta}>
        Status: {enrichment.status}
        {enrichment.skeleton ? " · skeleton response" : ""}
      </Text>
      <Text style={styles.meta}>Kilde: BBR/Datafordeler</Text>

      {profileRows.length > 0 ? (
        <View style={styles.detailGroup}>
          <Text style={styles.detailTitle}>Profile preview</Text>
          {profileRows.map(([label, value]) => (
            <Text style={styles.meta} key={label}>
              {label}: {value}
            </Text>
          ))}
        </View>
      ) : null}

      {enrichment.warnings.length > 0 ? (
        <View style={styles.detailGroup}>
          <Text style={styles.detailTitle}>Warnings</Text>
          {enrichment.warnings.map((warning, index) => (
            <Text style={styles.warningText} key={`${warning}-${index}`}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
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
  detailGroup: {
    rowGap: 5
  },
  detailTitle: {
    color: "#17211D",
    fontSize: 15,
    fontWeight: "700"
  },
  meta: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
  },
  warningText: {
    color: "#8E5A13",
    fontSize: 14,
    lineHeight: 21
  }
});
