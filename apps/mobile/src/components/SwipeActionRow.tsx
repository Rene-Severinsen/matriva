import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useEffect, useMemo, useRef } from "react";

import { theme } from "../theme";

export type SwipeAction = {
  label: string;
  accessibilityLabel?: string;
  icon?: string;
  tone?: "positive" | "neutral" | "destructive";
  onPress: () => void;
};

type SwipeActionRowProps = {
  children: React.ReactNode;
  rowId: string;
  swipeRightAction: SwipeAction;
  swipeLeftActions: SwipeAction[];
  onLongSwipeRight?: () => void;
  onLongSwipeLeft?: () => void;
  openRowId: string | null;
  actionWidth?: number;
  disabled?: boolean;
  onOpened: (rowId: string) => void;
};

const HORIZONTAL_ACTIVATION_DISTANCE = 10;
const OPEN_THRESHOLD = 34;
const LONG_SWIPE_DISTANCE = 120;

type GestureAxis = "horizontal" | "vertical";

function gestureAxisForState(
  gestureState: { dx: number; dy: number },
  disabled: boolean
): GestureAxis | null {
  if (disabled) {
    return null;
  }

  const horizontalDistance = Math.abs(gestureState.dx);
  const verticalDistance = Math.abs(gestureState.dy);

  if (
    horizontalDistance < HORIZONTAL_ACTIVATION_DISTANCE &&
    verticalDistance < HORIZONTAL_ACTIVATION_DISTANCE
  ) {
    return null;
  }

  return horizontalDistance > verticalDistance ? "horizontal" : "vertical";
}

export function SwipeActionRow({
  children,
  rowId,
  swipeRightAction,
  swipeLeftActions,
  onLongSwipeRight,
  onLongSwipeLeft,
  openRowId,
  actionWidth = 104,
  disabled = false,
  onOpened
}: SwipeActionRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const gestureAxis = useRef<"horizontal" | "vertical" | null>(null);
  const openOffset = useRef(0);
  const leftActionsWidth = actionWidth * swipeLeftActions.length;

  const positiveActionTranslateX = translateX.interpolate({
    inputRange: [0, actionWidth],
    outputRange: [-actionWidth, 0],
    extrapolate: "clamp"
  });
  const negativeActionsTranslateX = translateX.interpolate({
    inputRange: [-leftActionsWidth, 0],
    outputRange: [0, leftActionsWidth],
    extrapolate: "clamp"
  });

  const close = useMemo(
    () => () => {
      openOffset.current = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12
      }).start();
    },
    [translateX]
  );

  useEffect(() => {
    if (openRowId !== rowId) {
      close();
    }
  }, [close, openRowId, rowId]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (gestureAxis.current === "vertical") {
            return false;
          }

          const nextAxis = gestureAxisForState(gestureState, disabled);
          if (nextAxis) {
            gestureAxis.current = nextAxis;
          }

          return nextAxis === "horizontal";
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (gestureAxis.current === "vertical") {
            return false;
          }

          const nextAxis = gestureAxisForState(gestureState, disabled);
          if (nextAxis) {
            gestureAxis.current = nextAxis;
          }

          return nextAxis === "horizontal";
        },
        onPanResponderGrant: () => {
          startX.current = openOffset.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          if (gestureAxis.current !== "horizontal") {
            return;
          }

          const nextX = Math.max(
            -leftActionsWidth,
            Math.min(actionWidth, startX.current + gestureState.dx)
          );
          translateX.setValue(nextX);
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureAxis.current !== "horizontal") {
            gestureAxis.current = null;
            return;
          }

          const finalX = Math.max(
            -leftActionsWidth,
            Math.min(actionWidth, startX.current + gestureState.dx)
          );
          const longSwipeAction =
            Math.abs(gestureState.dx) >= LONG_SWIPE_DISTANCE
              ? gestureState.dx > 0
                ? onLongSwipeRight
                : onLongSwipeLeft
              : undefined;

          if (longSwipeAction) {
            close();
            gestureAxis.current = null;
            longSwipeAction();
            return;
          }

          const shouldOpen = Math.abs(finalX) >= OPEN_THRESHOLD;
          const target = shouldOpen ? (finalX > 0 ? actionWidth : -leftActionsWidth) : 0;

          if (shouldOpen) {
            openOffset.current = target;
            onOpened(rowId);
          } else {
            openOffset.current = 0;
          }

          Animated.spring(translateX, {
            toValue: target,
            useNativeDriver: true,
            tension: 80,
            friction: 12
          }).start();
          gestureAxis.current = null;
        },
        onPanResponderTerminate: () => {
          gestureAxis.current = null;
          close();
        },
        onPanResponderTerminationRequest: () => true
      }),
    [
      actionWidth,
      close,
      disabled,
      leftActionsWidth,
      onLongSwipeLeft,
      onLongSwipeRight,
      onOpened,
      rowId,
      translateX
    ]
  );

  function handleActionPress(action: SwipeAction) {
    close();
    action.onPress();
  }

  function actionStyle(tone: SwipeAction["tone"] | undefined) {
    if (tone === "destructive") {
      return styles.destructiveAction;
    }

    if (tone === "neutral") {
      return styles.neutralAction;
    }

    return styles.positiveAction;
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="box-none" style={styles.actionLayer}>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.actionGroup,
            styles.leftActionGroup,
            { transform: [{ translateX: positiveActionTranslateX }], width: actionWidth }
          ]}
        >
          <Pressable
            accessibilityLabel={swipeRightAction.accessibilityLabel ?? swipeRightAction.label}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleActionPress(swipeRightAction)}
            style={[styles.action, actionStyle(swipeRightAction.tone)]}
          >
            <Text style={styles.actionIcon}>{swipeRightAction.icon ?? "✓"}</Text>
            <Text style={styles.actionLabel}>{swipeRightAction.label}</Text>
          </Pressable>
        </Animated.View>
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.actionGroup,
            styles.rightActionGroup,
            { transform: [{ translateX: negativeActionsTranslateX }], width: leftActionsWidth }
          ]}
        >
          {swipeLeftActions.map((action) => (
            <Pressable
              accessibilityLabel={action.accessibilityLabel ?? action.label}
              accessibilityRole="button"
              disabled={disabled}
              key={action.label}
              onPress={() => handleActionPress(action)}
              style={[styles.action, actionStyle(action.tone)]}
            >
              <Text style={styles.actionIcon}>{action.icon ?? "⋯"}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: "hidden"
  },
  content: {
    zIndex: 1
  },
  actionLayer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden"
  },
  actionGroup: {
    bottom: 0,
    flexDirection: "row",
    position: "absolute",
    top: 0
  },
  leftActionGroup: {
    left: 0
  },
  rightActionGroup: {
    right: 0
  },
  action: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    rowGap: 2
  },
  positiveAction: {
    backgroundColor: theme.primary
  },
  neutralAction: {
    backgroundColor: theme.subtle
  },
  destructiveAction: {
    backgroundColor: theme.error
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
