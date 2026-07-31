import { StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

import { type HomeCard } from "@matriva/shared";

type HomeCardPreviewListProps = {
  title?: string;
  metaLabel?: string;
  cards: HomeCard[];
};

export function HomeCardPreviewList({
  title = "Første backend-kort",
  metaLabel = "Teknisk skeleton-kort",
  cards
}: HomeCardPreviewListProps) {
  return (
    <View style={styles.cardsSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {cards.map((card) => (
        <HomeCardPreview card={card} key={card.id} metaLabel={metaLabel} />
      ))}
    </View>
  );
}

type HomeCardPreviewProps = {
  card: HomeCard;
  metaLabel: string;
};

function HomeCardPreview({ card, metaLabel }: HomeCardPreviewProps) {
  return (
    <View style={styles.homeCard}>
      <Text style={styles.cardMeta}>
        {metaLabel} · {card.type} · {card.severity}
      </Text>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.bodySmall}>{card.shortExplanation}</Text>
      <Text style={styles.meta}>{card.fallbackText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardsSection: {
    rowGap: 10
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700"
  },
  homeCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    rowGap: 8
  },
  cardMeta: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23
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
