import Swipeable from "react-native-gesture-handler/Swipeable";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";

const DELETE_ACTION_WIDTH = 88;
const FULL_SWIPE_THRESHOLD = 120;

type NotificationSwipeableRowProps = {
  children: React.ReactNode;
  rowId: string;
  openRowId: string | null;
  onOpened: (rowId: string) => void;
  onDelete: () => void;
};

/**
 * Native-gesture-backed row for the notification inbox.
 *
 * RNGH owns the pan/tap arbitration here, which prevents the row's card press
 * from firing together with the trailing delete action. A deliberate left
 * swipe past the threshold deletes immediately; a shorter swipe exposes the
 * same red action used by Mail.
 */
export function NotificationSwipeableRow({
  children,
  rowId,
  openRowId,
  onOpened,
  onDelete
}: NotificationSwipeableRowProps) {
  const swipeableRef = useRef<Swipeable | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (openRowId !== rowId) {
      swipeableRef.current?.close();
    }
  }, [openRowId, rowId]);

  function deleteOnce() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    swipeableRef.current?.close();
    onDelete();
  }

  return (
    <Swipeable
      ref={swipeableRef}
      containerStyle={styles.container}
      dragOffsetFromRightEdge={10}
      friction={1}
      overshootRight
      overshootFriction={8}
      rightThreshold={FULL_SWIPE_THRESHOLD}
      renderRightActions={() => (
        <View style={styles.actionLayer}>
          <Pressable
            accessibilityLabel="Slet notifikation"
            accessibilityRole="button"
            onPress={deleteOnce}
            style={styles.deleteAction}
          >
            <Text style={styles.actionIcon}>×</Text>
            <Text style={styles.actionLabel}>Slet</Text>
          </Pressable>
        </View>
      )}
      onSwipeableWillOpen={(direction) => {
        if (direction === "right") {
          onOpened(rowId);
          deleteOnce();
        }
      }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden"
  },
  actionLayer: {
    width: DELETE_ACTION_WIDTH
  },
  deleteAction: {
    alignItems: "center",
    backgroundColor: theme.error,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    rowGap: 2
  },
  actionIcon: {
    color: theme.surface,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22
  },
  actionLabel: {
    color: theme.surface,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center"
  }
});
