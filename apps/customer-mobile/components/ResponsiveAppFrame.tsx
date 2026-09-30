import { getAdaptiveDeviceLayout, type AdaptiveDeviceLayout, type FoldFeature } from "@mansamart/design-system";
import React, { createContext, type ReactNode, useContext, useMemo } from "react";
import { NativeModules, Platform, StyleSheet, useWindowDimensions, View } from "react-native";

const DeviceLayoutContext = createContext<AdaptiveDeviceLayout>(getAdaptiveDeviceLayout(390, 844));

function getNativeFoldFeature(): FoldFeature | null {
  const feature = NativeModules.MansaMartWindowLayout?.currentFoldFeature;
  if (!feature || (feature.orientation !== "vertical" && feature.orientation !== "horizontal")) return null;
  return { orientation: feature.orientation, posture: feature.posture, size: feature.size };
}

export function useDeviceLayout() {
  return useContext(DeviceLayoutContext);
}

export function ResponsiveAppFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => getAdaptiveDeviceLayout(width, height, getNativeFoldFeature()), [width, height]);
  return (
    <DeviceLayoutContext.Provider value={layout}>
      <View style={styles.viewport}>
        <View style={styles.app}>{children}</View>
      </View>
    </DeviceLayoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: "center", backgroundColor: Platform.OS === "web" ? "#E8EFEC" : "transparent" },
  app: { flex: 1, width: "100%", maxWidth: 1440, backgroundColor: "#F4F8F6" },
});
