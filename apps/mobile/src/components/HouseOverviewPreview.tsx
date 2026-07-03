import { StyleSheet, Text, View } from "react-native";

import { type HouseDraftOverviewPreviewResponse } from "@matriva/shared";

type HouseOverviewPreviewProps = {
  preview: HouseDraftOverviewPreviewResponse;
};

export function HouseOverviewPreview({ preview }: HouseOverviewPreviewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{preview.dataConfidence}</Text>
        <Text style={styles.title}>{preview.title}</Text>
        <Text style={styles.subtitle}>{preview.subtitle}</Text>
      </View>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>{preview.warningTitle}</Text>
        <Text style={styles.warningBody}>{preview.warningBody}</Text>
      </View>

      {preview.sections.map((section) => (
        <View key={section.kind} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.intro ? (
            <Text style={styles.sectionIntro}>{section.intro}</Text>
          ) : null}

          {section.cards.map((card) => (
            <View key={card.id} style={styles.card}>
              {card.statusLabel ? (
                <Text style={styles.cardMeta}>{card.statusLabel}</Text>
              ) : null}
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
              {card.cta ? (
                <View style={styles.disabledCta}>
                  <Text style={styles.disabledCtaLabel}>{card.cta.label}</Text>
                  <Text style={styles.disabledCtaReason}>{card.cta.reason}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    rowGap: 14
  },
  header: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    rowGap: 6
  },
  eyebrow: {
    color: "#69746F",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  title: {
    color: "#17211D",
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    color: "#33423C",
    fontSize: 17,
    fontWeight: "700"
  },
  warning: {
    backgroundColor: "#FFF8E8",
    borderColor: "#D9B85F",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 6
  },
  warningTitle: {
    color: "#5C4612",
    fontSize: 16,
    fontWeight: "700"
  },
  warningBody: {
    color: "#5C4612",
    fontSize: 14,
    lineHeight: 21
  },
  section: {
    rowGap: 10
  },
  sectionTitle: {
    color: "#17211D",
    fontSize: 20,
    fontWeight: "700"
  },
  sectionIntro: {
    color: "#5B6862",
    fontSize: 14,
    lineHeight: 21
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  cardMeta: {
    color: "#69746F",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: "#17211D",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23
  },
  cardBody: {
    color: "#33423C",
    fontSize: 15,
    lineHeight: 22
  },
  disabledCta: {
    borderColor: "#D7D0C4",
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    rowGap: 4
  },
  disabledCtaLabel: {
    color: "#69746F",
    fontSize: 14,
    fontWeight: "700"
  },
  disabledCtaReason: {
    color: "#69746F",
    fontSize: 13,
    lineHeight: 19
  }
});
