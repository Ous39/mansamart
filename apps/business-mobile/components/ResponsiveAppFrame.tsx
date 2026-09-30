import React, { type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";

export function ResponsiveAppFrame({ children }: { children: ReactNode }) {
  return <View style={styles.viewport}><View style={styles.app}>{children}</View></View>;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: "center", backgroundColor: Platform.OS === "web" ? "#E8EFEC" : "transparent" },
  app: { flex: 1, width: "100%", maxWidth: 1440, backgroundColor: "#F4F8F6" },
});
