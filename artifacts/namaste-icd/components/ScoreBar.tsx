import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

interface ScoreBarProps {
  score: number;
}

export function ScoreBar({ score }: ScoreBarProps) {
  const C = Colors.light;
  const pct = Math.round(score * 100);
  let color = C.scoreLow;
  if (pct >= 70) color = C.scoreHigh;
  else if (pct >= 45) color = C.scoreMid;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: C.backgroundTertiary }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 32,
    textAlign: "right",
  },
});
