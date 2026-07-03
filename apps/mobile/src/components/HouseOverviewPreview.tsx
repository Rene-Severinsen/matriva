import { StyleSheet, Text, View } from "react-native";

import {
  type HouseDraftOverviewPreviewCard,
  type HouseDraftOverviewPreviewMaintenanceSeason,
  type HouseDraftOverviewPreviewResponse
} from "@matriva/shared";

type HouseOverviewPreviewProps = {
  preview: HouseDraftOverviewPreviewResponse;
};

const maintenanceSourceLabels = {
  user_created: "Egen opgave",
  matriva_recommended: "Anbefalet af Matriva"
} as const;

const maintenanceSeasonLabels: Record<
  HouseDraftOverviewPreviewMaintenanceSeason,
  string
> = {
  spring: "Forår",
  summer: "Sommer",
  autumn: "Efterår",
  winter: "Vinter",
  all_year: "Hele året"
};

function formatDanishDate(dateOnly: string): string {
  const [, month, day] = dateOnly.split("-");
  const monthNames = [
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december"
  ];
  const monthIndex = Number(month) - 1;

  return `${Number(day)}. ${monthNames[monthIndex] ?? month}`;
}

function getMaintenanceLabels(card: HouseDraftOverviewPreviewCard): string[] {
  const maintenance = card.maintenance;

  if (!maintenance) {
    return [];
  }

  const labels: string[] = [maintenanceSourceLabels[maintenance.source]];

  if (
    maintenance.timingType === "specific_deadline" &&
    maintenance.dueDate
  ) {
    labels.push(`Deadline: ${formatDanishDate(maintenance.dueDate)}`);
  }

  if (maintenance.timingType === "seasonal_window" && maintenance.season) {
    labels.push(`Sæson: ${maintenanceSeasonLabels[maintenance.season]}`);
  }

  if (maintenance.daysUntilDue !== undefined) {
    labels.push(`Forfalder om ${maintenance.daysUntilDue} dage`);
  }

  if (maintenance.daysOverdue !== undefined) {
    labels.push(`Overskredet med ${maintenance.daysOverdue} dage`);
  }

  return labels;
}

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

          {section.cards.map((card) => {
            const maintenanceLabels = getMaintenanceLabels(card);

            return (
              <View key={card.id} style={styles.card}>
                {card.statusLabel && !card.maintenance ? (
                  <Text style={styles.cardMeta}>{card.statusLabel}</Text>
                ) : null}
                {maintenanceLabels.length > 0 ? (
                  <View style={styles.metaList}>
                    {maintenanceLabels.map((label) => (
                      <Text key={label} style={styles.maintenanceMeta}>
                        {label}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardBody}>{card.body}</Text>
                {card.cta ? (
                  <View style={styles.disabledCta}>
                    <Text style={styles.disabledCtaLabel}>{card.cta.label}</Text>
                    <Text style={styles.disabledCtaReason}>
                      {card.cta.reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
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
  metaList: {
    rowGap: 4
  },
  maintenanceMeta: {
    color: "#69746F",
    fontSize: 12,
    fontWeight: "700"
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    rowGap: 3
  },
  disabledCtaLabel: {
    color: "#69746F",
    fontSize: 13,
    fontWeight: "700"
  },
  disabledCtaReason: {
    color: "#69746F",
    fontSize: 12,
    lineHeight: 17
  }
});
