import { StyleSheet, Text, View } from "react-native";

import { type EnrichHouseDraftResponse } from "@matriva/shared";

type HouseEnrichmentSummaryProps = {
  response: EnrichHouseDraftResponse;
};

export function HouseEnrichmentSummary({
  response
}: HouseEnrichmentSummaryProps) {
  const { enrichment, profilePreview } = response;
  const warnings =
    enrichment.warningDetails.length > 0
      ? enrichment.warningDetails.map((warning) => warning.message)
      : enrichment.warnings;
  const sourceStatus =
    enrichment.source.verificationStatus === "verified"
      ? "Verificeret"
      : enrichment.source.verificationStatus === "unavailable"
        ? "Ikke tilgængelig"
        : "Ikke verificeret";
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
      <Text style={styles.previewLabel}>Teknisk preview</Text>
      <Text style={styles.sectionTitle}>Ikke verificerede boligdata</Text>
      <Text style={styles.bodySmall}>
        Dette er en teknisk skeleton-preview fra Matriva API. Det er ikke live
        BBR-data og må ikke læses som verificerede boligoplysninger.
      </Text>
      <Text style={styles.meta}>
        Status: {sourceStatus}
        {enrichment.skeleton ? " · skeleton" : ""}
      </Text>
      <Text style={styles.meta}>Kilde-label: {enrichment.source.label}</Text>
      <Text style={styles.meta}>Preview-status: {enrichment.status}</Text>

      {profileRows.length > 0 ? (
        <View style={styles.detailGroup}>
          <Text style={styles.detailTitle}>Profil-preview</Text>
          {profileRows.map(([label, value]) => (
            <Text style={styles.meta} key={label}>
              {label}: {value}
            </Text>
          ))}
        </View>
      ) : null}

      {warnings.length > 0 ? (
        <View style={styles.detailGroup}>
          <Text style={styles.detailTitle}>Advarsler</Text>
          {warnings.map((warning, index) => (
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
