import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  formatValue?: (v: number) => string;
  barColor?: string;
}

export function BarChart({ data, height = 120, formatValue, barColor }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.container}>
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => {
          const pct = d.value / max;
          const barH = Math.max(pct * height * 0.85, d.value > 0 ? 4 : 0);
          const color = d.color ?? barColor ?? Colors.primary;
          return (
            <View key={i} style={styles.barCol}>
              {d.value > 0 && (
                <Text style={[styles.barValue, { color }]}>
                  {formatValue ? formatValue(d.value) : d.value}
                </Text>
              )}
              <View style={[styles.bar, { height: barH, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={i} style={styles.label}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 9, fontFamily: "Inter_700Bold" },
  bar: { width: "100%", borderRadius: 6 },
  labels: { flexDirection: "row", gap: 6 },
  label: { flex: 1, textAlign: "center", fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textMuted },
});
