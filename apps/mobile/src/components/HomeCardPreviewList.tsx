import { StyleSheet, Text, View } from "react-native";

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
    color: "#17211D",
    fontSize: 20,
    fontWeight: "700"
  },
  homeCard: {
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
